-- Drop existing table if it exists
DROP TABLE IF EXISTS clinic_appointments;

-- Create clinic_appointments table with updated schema
CREATE TABLE clinic_appointments (
    appointment_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_name TEXT NOT NULL,
    patient_medical_number TEXT NOT NULL,
    clinic_specialty TEXT NOT NULL,
    appointment_type TEXT NOT NULL CHECK (appointment_type IN ('Urgent', 'Regular')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX idx_clinic_appointments_created_at 
ON clinic_appointments(created_at);

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_clinic_appointments_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clinic_appointments_timestamp
    BEFORE UPDATE ON clinic_appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_clinic_appointments_timestamp();

-- Create view for daily report integration
CREATE OR REPLACE VIEW daily_clinic_appointments AS
SELECT 
    appointment_id,
    patient_name,
    patient_medical_number,
    clinic_specialty,
    appointment_type,
    notes,
    created_at,
    updated_at,
    DATE(created_at) as appointment_date
FROM clinic_appointments
ORDER BY created_at DESC;

-- Add example data (optional, remove in production)
INSERT INTO clinic_appointments 
    (patient_name, patient_medical_number, clinic_specialty, appointment_type, notes)
VALUES 
    ('John Doe', 'MRN123456', 'General Internal Medicine', 'Regular', 'Initial consultation'),
    ('Jane Smith', 'MRN789012', 'Cardiology', 'Urgent', 'Follow-up appointment');