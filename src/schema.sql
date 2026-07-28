-- Cash Management App - PostgreSQL Schema
-- Run this on your alwaysdata PostgreSQL database

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  alias VARCHAR(100) NOT NULL,
  fcm_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  icon VARCHAR(50),
  color VARCHAR(7),
  is_preset BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense', 'savings', 'emergency')),
  category_id UUID REFERENCES categories(id),
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'paid' CHECK (status IN ('paid', 'pending')),
  is_auto_generated BOOLEAN DEFAULT false,
  recurring_id UUID,
  created_by_device UUID REFERENCES devices(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT,
  preferred_day INT CHECK (preferred_day BETWEEN 1 AND 31),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_room_date ON transactions(room_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(room_id, type);
CREATE INDEX IF NOT EXISTS idx_recurring_room ON recurring_expenses(room_id);
CREATE INDEX IF NOT EXISTS idx_categories_room ON categories(room_id);

-- Seed preset categories (inserted per room when created)
-- 'Agua', 'Luz', 'Teléfono', 'Internet', 'Gas', 'Supermercado',
-- 'Transporte', 'Renta', 'Seguros', 'Salud', 'Educación',
-- 'Entretenimiento', 'Otros'
