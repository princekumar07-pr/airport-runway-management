const pool = require('./db');
const mutex = require('./mutex');
const SLOT_MINUTES = 20; // prototype runway occupancy per operation
const GAP_MINUTES = 10; // safety buffer between operations

function priorityScore(p) { return ({EMERGENCY: 0, HIGH: 1, NORMAL: 2})[p] ?? 2; }
function asDate(value) { return new Date(value); }
function addMinutes(date, mins) { return new Date(date.getTime() + mins * 60000); }
function overlaps(start, end, otherStart, otherEnd) {
  // Expand occupied window by a small buffer on both sides.
  const paddedStart = addMinutes(start, -GAP_MINUTES);
  const paddedEnd = addMinutes(end, GAP_MINUTES);
  return paddedStart < otherEnd && paddedEnd > otherStart;
}

async function allocateFlight(flightId) {
  return mutex.runExclusive(async () => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[flight]] = await conn.query('SELECT * FROM flights WHERE id=? FOR UPDATE', [flightId]);
      if (!flight) throw new Error('Flight not found');
      if (flight.status === 'CANCELLED' || flight.status === 'COMPLETED') throw new Error('This flight cannot be allocated in its current status');
      const target = asDate(flight.scheduled_time);
      const end = addMinutes(target, SLOT_MINUTES);
      const [runways] = await conn.query("SELECT * FROM runways WHERE status='AVAILABLE' ORDER BY runway_code");
      let selected = null;
      for (const runway of runways) {
        const [existing] = await conn.query("SELECT start_time,end_time FROM allocations WHERE runway_id=? AND allocation_status='ACTIVE'", [runway.id]);
        const busy = existing.some(a => overlaps(target, end, asDate(a.start_time), asDate(a.end_time)));
        if (!busy) { selected = runway; break; }
      }
      if (!selected) throw new Error('No runway is available for this time slot. Flight remains waiting.');
      await conn.query("INSERT INTO allocations (flight_id,runway_id,start_time,end_time,allocation_status) VALUES (?,?,?,?,'ACTIVE')", [flight.id, selected.id, target, end]);
      await conn.query("UPDATE flights SET status='ALLOCATED' WHERE id=?", [flight.id]);
      await conn.query('INSERT INTO system_logs (event_type,message) VALUES (?,?)', ['ALLOCATION', `${flight.flight_code} allocated to ${selected.runway_code}`]);
      await conn.commit();
      return {flight_code: flight.flight_code, runway_code: selected.runway_code, start_time: target, end_time: end};
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally { conn.release(); }
  });
}
async function runScheduler() {
  // OS PBL: priority scheduling; Emergency then High then Normal, FCFS within priority.
  const [flights] = await pool.query("SELECT id,flight_code,priority,scheduled_time FROM flights WHERE status IN ('SCHEDULED','WAITING') ORDER BY CASE priority WHEN 'EMERGENCY' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END, scheduled_time ASC");
  const results = [];
  for (const flight of flights) {
    try { results.push({ok:true, ...(await allocateFlight(flight.id))}); }
    catch (e) {
      await pool.query("UPDATE flights SET status='WAITING' WHERE id=? AND status<>'CANCELLED'", [flight.id]);
      await pool.query('INSERT INTO system_logs (event_type,message) VALUES (?,?)', ['QUEUE', `${flight.flight_code} placed in waiting queue: ${e.message}`]);
      results.push({ok:false, flight_code:flight.flight_code, message:e.message});
    }
  }
  return results;
}
module.exports = {allocateFlight, runScheduler};
