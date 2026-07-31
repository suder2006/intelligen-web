// Every column of `schools` except the GetePay credentials.
//
// anon and authenticated have no SELECT privilege on getepay_key / getepay_iv /
// getepay_url, so `select('*')` from the browser fails for the whole row. Client
// code must select this list instead. Server routes that genuinely need the
// credentials use the service role, which bypasses column grants.
export const SCHOOL_SAFE_COLUMNS = [
  'id', 'name', 'address', 'phone', 'email', 'logo_url', 'created_at',
  'primary_color', 'status', 'created_by', 'website', 'established_year',
  'upi_id', 'upi_name', 'upi_description', 'payment_method',
  'razorpay_key_id', 'razorpay_key_secret', 'payu_merchant_key',
  'payu_merchant_salt', 'birthday_message_template', 'module_access_password',
  'getepay_mid', 'getepay_terminal_id',
  'slug', 'school_address', 'school_contact_email', 'school_phone',
  'policy_privacy', 'policy_terms', 'policy_refund',
].join(', ')
