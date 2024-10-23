-- Check if the constraint exists before adding it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'daily_reports_patient_id_fkey'
    ) THEN
        ALTER TABLE daily_reports
        ADD CONSTRAINT daily_reports_patient_id_fkey 
        FOREIGN KEY (patient_id) 
        REFERENCES patients(mrn)
        ON DELETE CASCADE;
    END IF;
END $$;

-- Create or replace function to handle report creation
CREATE OR REPLACE FUNCTION create_daily_report(
  p_patient_id TEXT,
  p_report_date DATE,
  p_report_content TEXT,
  p_created_by TEXT
) RETURNS daily_reports AS $$
DECLARE
  v_report daily_reports;
BEGIN
  INSERT INTO daily_reports (
    patient_id,
    report_date,
    report_content,
    created_by,
    created_at
  ) VALUES (
    p_patient_id,
    p_report_date,
    p_report_content,
    p_created_by,
    CURRENT_TIMESTAMP
  )
  RETURNING * INTO v_report;
  
  RETURN v_report;
END;
$$ LANGUAGE plpgsql;

-- Create index if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE indexname = 'idx_daily_reports_report_date'
    ) THEN
        CREATE INDEX idx_daily_reports_report_date ON daily_reports(report_date);
    END IF;
END $$;

-- Drop view if exists and create new one
DROP VIEW IF EXISTS combined_daily_reports;
CREATE VIEW combined_daily_reports AS
SELECT 
  dr.*,
  COALESCE(p.patient_name, c.patient_name) as patient_name,
  COALESCE(p.specialty, c.consultation_specialty) as specialty
FROM daily_reports dr
LEFT JOIN patients p ON dr.patient_id = p.mrn
LEFT JOIN consultations c ON dr.patient_id = c.mrn;

-- Create trigger function for automatic cleanup of old reports
CREATE OR REPLACE FUNCTION cleanup_old_daily_reports() RETURNS trigger AS $$
BEGIN
  DELETE FROM daily_reports
  WHERE report_date < CURRENT_DATE - INTERVAL '30 days';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trigger_cleanup_old_daily_reports'
    ) THEN
        CREATE TRIGGER trigger_cleanup_old_daily_reports
        AFTER INSERT ON daily_reports
        EXECUTE FUNCTION cleanup_old_daily_reports();
    END IF;
END $$;