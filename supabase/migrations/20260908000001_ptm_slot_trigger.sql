-- Keeps ptm_slots.is_available in step with the bookings on that slot.
--
-- Cancelling a booking frees its slot again, but only once no other live
-- booking still holds it; a new or reinstated booked/confirmed booking holds
-- the slot. Without this, a cancelled booking left the slot marked unavailable
-- and it disappeared from the parent's list of bookable slots for good.
--
-- Firing on INSERT as well as UPDATE means a newly booked slot is held at the
-- database level, not only by the app's conditional claim on ptm_slots.
--
-- NOTE: the production Supabase project already has this trigger in its
-- UPDATE-only form; re-running this file is safe (the DROP makes it
-- repeatable) and upgrades it to also cover INSERT.

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

DROP TRIGGER IF EXISTS ptm_booking_status_trigger ON ptm_bookings;

CREATE TRIGGER ptm_booking_status_trigger
AFTER INSERT OR UPDATE ON ptm_bookings
FOR EACH ROW
EXECUTE FUNCTION update_slot_availability();
