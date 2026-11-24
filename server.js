require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./db');
const {allocateFlight, runScheduler} = require('./scheduler');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
app.get('/api/health', asyncRoute(async (req,res) => { await pool.query('SELECT 1'); res.json({ok:true, service:'ARMS API', database:'connected'}); }));
app.get('/api/dashboard', asyncRoute(async (req,res) => {
  const [[{total}]] = await pool.query('SELECT COUNT(*) total FROM flights');
  const [[{scheduled}]] = await pool.query("SELECT COUNT(*) scheduled FROM flights WHERE status='SCHEDULED'");
  const [[{waiting}]] = await pool.query("SELECT COUNT(*) waiting FROM flights WHERE status='WAITING'");
  const [[{allocated}]] = await pool.query("SELECT COUNT(*) allocated FROM flights WHERE status='ALLOCATED'");
  const [[{availableRunways}]] = await pool.query("SELECT COUNT(*) availableRunways FROM runways WHERE status='AVAILABLE'");
  const [[{totalRunways}]] = await pool.query('SELECT COUNT(*) totalRunways FROM runways');
  const [recent] = await pool.query("SELECT f.*, r.runway_code, a.start_time allocation_start, a.end_time allocation_end FROM flights f LEFT JOIN allocations a ON a.flight_id=f.id AND a.allocation_status='ACTIVE' LEFT JOIN runways r ON r.id=a.runway_id ORDER BY f.scheduled_time LIMIT 8");
  res.json({stats:{total,scheduled,waiting,allocated,availableRunways,totalRunways},recent});
}));
app.get('/api/flights', asyncRoute(async (req,res) => {
  const [rows] = await pool.query("SELECT f.*,r.runway_code,a.start_time allocation_start,a.end_time allocation_end FROM flights f LEFT JOIN allocations a ON a.flight_id=f.id AND a.allocation_status='ACTIVE' LEFT JOIN runways r ON r.id=a.runway_id ORDER BY f.scheduled_time");
  res.json(rows);
}));
app.post('/api/flights', asyncRoute(async (req,res) => {
  const {flight_code, airline, origin, destination, flight_type, scheduled_time, priority} = req.body;
  if (![flight_code,airline,origin,destination,flight_type,scheduled_time].every(Boolean)) return res.status(400).json({error:'Please fill in every required field.'});
  if (!['ARRIVAL','DEPARTURE'].includes(flight_type)) return res.status(400).json({error:'Flight type must be Arrival or Departure.'});
  const date = new Date(scheduled_time);
  if (Number.isNaN(date.getTime())) return res.status(400).json({error:'Invalid date/time.'});
  const [result] = await pool.query('INSERT INTO flights (flight_code,airline,origin,destination,flight_type,scheduled_time,priority,status) VALUES (?,?,?,?,?,?,?,?)', [flight_code.toUpperCase(),airline,origin,destination,flight_type,date,priority || 'NORMAL','SCHEDULED']);
  await pool.query('INSERT INTO system_logs (event_type,message) VALUES (?,?)', ['FLIGHT_ADDED', `${flight_code.toUpperCase()} added to schedule`]);
  res.status(201).json({id:result.insertId,message:'Flight added successfully'});
}));
app.patch('/api/flights/:id/status', asyncRoute(async (req,res) => {
  const {status} = req.body;
  if (!['SCHEDULED','WAITING','COMPLETED','CANCELLED'].includes(status)) return res.status(400).json({error:'Invalid status'});
  await pool.query('UPDATE flights SET status=? WHERE id=?', [status,req.params.id]);
  await pool.query('INSERT INTO system_logs (event_type,message) VALUES (?,?)', ['STATUS',`Flight ${req.params.id} status changed to ${status}`]);
  res.json({message:'Flight status updated'});
}));
app.get('/api/runways', asyncRoute(async (req,res) => {
  const [rows] = await pool.query("SELECT r.*, (SELECT COUNT(*) FROM allocations a WHERE a.runway_id=r.id AND a.allocation_status='ACTIVE') active_allocations FROM runways r ORDER BY runway_code");
  res.json(rows);
}));
app.post('/api/allocate/:flightId', asyncRoute(async (req,res) => { res.json(await allocateFlight(req.params.flightId)); }));
app.post('/api/scheduler/run', asyncRoute(async (req,res) => { res.json({results:await runScheduler()}); }));
app.get('/api/logs', asyncRoute(async (req,res) => { const [rows]=await pool.query('SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 100'); res.json(rows); }));
app.use((err,req,res,next) => { console.error(err); res.status(500).json({error:err.code==='ER_DUP_ENTRY'?'Flight code already exists.':err.message || 'Server error'}); });
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`ARMS running at http://localhost:${PORT}`));
