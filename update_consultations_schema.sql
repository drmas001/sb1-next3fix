-- Add completed_at column to consultations table
ALTER TABLE consultations 
ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;

-- Update existing completed consultations
UPDATE consultations 
SET completed_at = updated_at 
WHERE status = 'Completed';

-- Add trigger to automatically set completed_at when status changes to Completed
CREATE OR REPLACE FUNCTION set_consultation_completed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'Completed' AND OLD.status != 'Completed' THEN
        NEW.completed_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consultation_completed_at_trigger
    BEFORE UPDATE ON consultations
    FOR EACH ROW
    EXECUTE FUNCTION set_consultation_completed_at();