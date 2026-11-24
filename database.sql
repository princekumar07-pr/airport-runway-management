CREATE DATABASE IF NOT EXISTS arms_db;
USE arms_db;

CREATE TABLE IF NOT EXISTS runways (
  id INT AUTO_INCREMENT PRIMARY KEY,
  runway_code VARCHAR(20) NOT NULL UNIQUE,
  status ENUM('AVAILABLE','MAINTENANCE') NOT NULL DEFAULT 'AVAILABLE',
  notes VARCHAR(255) NULL
);

CREATE TABLE IF NOT EXISTS flights (
  id INT AUTO_INCREMENT PRIMARY KEY,
  flight_code VARCHAR(20) NOT NULL UNIQUE,
  airline VARCHAR(80) NOT NULL,
  origin VARCHAR(80) NOT NULL,
  destination VARCHAR(80) NOT NULL,
  flight_type ENUM('ARRIVAL','DEPARTURE') NOT NULL,
  scheduled_time DATETIME NOT NULL,
  priority ENUM('NORMAL','HIGH','EMERGENCY') NOT NULL DEFAULT 'NORMAL',
  status ENUM('SCHEDULED','WAITING','ALLOCATED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS allocations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  flight_id INT NOT NULL,
  runway_id INT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  allocation_status ENUM('ACTIVE','RELEASED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_alloc_flight FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE,
  CONSTRAINT fk_alloc_runway FOREIGN KEY (runway_id) REFERENCES runways(id),
  INDEX idx_runway_time (runway_id, start_time, end_time),
  INDEX idx_flight_alloc (flight_id)
);


CREATE TABLE IF NOT EXISTS system_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(40) NOT NULL,
  message VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


INSERT IGNORE INTO runways (runway_code, status, notes) VALUES
('RWY-09','AVAILABLE','Demo runway'),
('RWY-18','AVAILABLE','Demo runway'),
('RWY-27','AVAILABLE','Demo runway');

INSERT IGNORE INTO flights (flight_code, airline, origin, destination, flight_type, scheduled_time, priority, status) VALUES
('AI-101','Air India','Delhi','Dehradun','ARRIVAL',DATE_ADD(NOW(), INTERVAL 20 MINUTE),'NORMAL','SCHEDULED'),
('6E-208','IndiGo','Dehradun','Mumbai','DEPARTURE',DATE_ADD(NOW(), INTERVAL 35 MINUTE),'NORMAL','SCHEDULED'),
('UK-332','Vistara','Bengaluru','Dehradun','ARRIVAL',DATE_ADD(NOW(), INTERVAL 45 MINUTE),'HIGH','SCHEDULED'),
('SG-550','SpiceJet','Dehradun','Jaipur','DEPARTURE',DATE_ADD(NOW(), INTERVAL 55 MINUTE),'NORMAL','SCHEDULED'),
('AI-909','Air India','Kolkata','Dehradun','ARRIVAL',DATE_ADD(NOW(), INTERVAL 70 MINUTE),'EMERGENCY','SCHEDULED');
