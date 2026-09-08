-- Keeps ptm_slots.is_available in step with the bookings on that slot.
--
-- Cancelling a booking frees its slot again, but only once no other live
-- booking still holds it; moving a booking back to booked/confirmed re-holds
-- the slot. Without this, a cancelled booking left the slot marked unavailable
-- and it disappeared from the parent's list of bookable slots for good.
--
-- NOTE: this trigger is already applied on the production Supabase project.
-- This file exists for documentation and version control.

CREATE OR REPLACE FUNCTION update_slot_availability()
RETURNS TRIGGER AS $$
DECLARE
  active_count INTEGER;
BEGIN
  IF NEW.status = 'cancelled' THEN
    SELECT COUNT(*) INTO active_count
    FROM ptm_bookings
    WHERE slot_id = NEW.slot_id
    AND status NOT IN ('cancelled')
    AND id != NEW.id;

    IF active_count = 0 THEN
      UPDATE ptm_slots
      SET is_available = true
      WHERE id = NEW.slot_id;
    END IF;

  ELSIF NEW.status IN ('booked', 'confirmed') THEN
    UPDATE ptm_slots
    SET is_available = false
    WHERE id = NEW.slot_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ptm_booking_status_trigger
AFTER UPDATE ON ptm_bookings
FOR EACH ROW
EXECUTE FUNCTION update_slot_availability();
