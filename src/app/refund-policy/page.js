export default function RefundPolicy() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#fff', fontFamily: "'DM Sans', sans-serif", padding: '48px 24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '48px' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
            Intelli<span style={{ color: '#38bdf8' }}>Gen</span>
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>Refund & Cancellation Policy</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Last updated: June 2025</p>
        </div>

        {/* Summary Box */}
        <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '16px', padding: '20px', marginBottom: '36px' }}>
          <div style={{ fontWeight: '700', color: '#38bdf8', marginBottom: '12px', fontSize: '15px' }}>📋 Quick Summary</div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {[
              { icon: '✅', text: '7-day money-back guarantee for new subscribers' },
              { icon: '✅', text: 'Pro-rata refund if we fail to provide the service' },
              { icon: '✅', text: 'Immediate cancellation available anytime' },
              { icon: '❌', text: 'No refund for mid-cycle cancellations after 7 days' },
              { icon: '❌', text: 'No refund for violation of Terms of Service' },
              { icon: '💳', text: 'School fee payments are non-refundable through IntelliGen' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {[
          {
            title: '1. Overview',
            content: `This Refund and Cancellation Policy applies to all subscriptions and payments made to IntelliGen Technologies for the IntelliGen preschool management platform. Please read this policy carefully before subscribing.

This policy covers:
• IntelliGen platform subscription fees paid by schools
• Add-on feature fees
• Setup and onboarding fees

This policy does NOT cover school fee payments made by parents to schools through the IntelliGen payment portal. Those transactions are between parents and the respective schools.`
          },
          {
            title: '2. Subscription Cancellation',
            content: `How to Cancel
You may cancel your IntelliGen subscription at any time by:
• Going to Admin Portal → Settings → Subscription → Cancel Plan
• Emailing us at getintelligen@gmail.com with your school name and registered email
• Calling us at +91 99620 48869 during business hours

When Cancellation Takes Effect
• Cancellation takes effect at the end of your current billing period
• You will retain full access to all features until the end of the paid period
• No further charges will be made after cancellation is confirmed
• You will receive a cancellation confirmation email within 24 hours

Data After Cancellation
• Your data remains accessible for 30 days after the subscription ends
• We strongly recommend exporting your data before this period expires
• After 30 days, all data is permanently and irreversibly deleted
• We are not liable for data loss after the 30-day grace period`
          },
          {
            title: '3. Refund Policy for Subscription Fees',
            content: `7-Day Money-Back Guarantee (New Subscribers)
New schools subscribing to IntelliGen for the first time are eligible for a full refund if:
• The refund request is made within 7 days of the first payment
• The school has not violated our Terms of Service
• This guarantee applies only to the first subscription payment

To claim your money-back guarantee, email getintelligen@gmail.com with:
• Subject line: "Refund Request — [Your School Name]"
• Your registered email address
• Reason for cancellation (optional but helpful)
• Payment transaction ID

Refunds under the money-back guarantee are processed within 7–10 business days to the original payment method.

After the 7-Day Period
After the initial 7-day period, subscription fees are generally non-refundable:
• No refunds for partial months or unused days in a billing period
• No refunds if you choose to stop using the platform mid-cycle
• No refunds for features you chose not to use

Exceptions — Pro-Rata Refund Eligibility
You may be eligible for a pro-rata refund in the following circumstances:
• Significant platform downtime (exceeding 72 continuous hours) caused by us
• We discontinue the IntelliGen service entirely
• We are unable to provide a core feature as described, despite reasonable notice and time to resolve

Annual Plan Cancellations
• Annual plans cancelled within the first 30 days: Full refund minus a 10% processing fee
• Annual plans cancelled between 30–90 days: 50% refund of remaining months
• Annual plans cancelled after 90 days: No refund for remaining period`
          },
          {
            title: '4. School Fee Payments (Parent Payments)',
            content: `Payments Made by Parents to Schools

IntelliGen provides a payment gateway for parents to pay school fees to their respective schools. These are direct transactions between parents and schools.

Important Notice:
• IntelliGen is not a party to fee payment transactions between parents and schools
• We do not hold, control, or have access to school fee funds
• Refunds for school fees must be requested directly from your school
• IntelliGen has no authority to issue refunds for school fee payments

Payment Errors
In the rare event of a technical error causing a double charge or incorrect amount:
• Contact us immediately at getintelligen@gmail.com or +91 99620 48869
• Provide your transaction ID and payment details
• We will investigate and coordinate with the payment processor
• Technical error refunds are processed within 5–7 business days

Payment Failures
If a payment fails but your account is charged:
• Contact us within 48 hours with your transaction ID
• We will verify with our payment processor and resolve within 3 business days`
          },
          {
            title: '5. Refund Process',
            content: `How to Request a Refund

Step 1 — Contact Us
Email: getintelligen@gmail.com
Subject: "Refund Request — [Your School Name]"

Include in your email:
• Registered school name
• Registered administrator email
• Payment date and amount
• Payment transaction ID (from your email receipt)
• Reason for refund request

Step 2 — Review
We will review your request within 2 business days and respond with our decision.

Step 3 — Processing
Approved refunds are processed within 7–10 business days. The timeline depends on your bank or card issuer after we initiate the refund.

Refund Methods
• Online payments (GetePay): Refunded to original payment method (card/UPI/bank)
• Bank transfer payments: Refunded to the source bank account

Processing Fees
• Original payment processing fees (charged by payment gateways) are non-refundable
• A processing fee of up to 5% may be deducted from refunds at our discretion`
          },
          {
            title: '6. Non-Refundable Items',
            content: `The following are strictly non-refundable:

• Setup fees, onboarding fees, and data migration fees
• Custom development or customization work completed
• Training sessions and workshops conducted
• Subscription fees after the 7-day money-back guarantee period (except exceptions in Section 3)
• Fees for accounts suspended due to Terms of Service violations
• SMS or push notification credits consumed
• Any fees related to third-party integrations or add-ons`
          },
          {
            title: '7. Free Trial Policy',
            content: `If IntelliGen offers a free trial period:

• No credit card or payment is required to start a free trial
• Free trials automatically expire at the end of the trial period
• You will not be charged unless you explicitly choose to subscribe
• No refunds apply to free trials as no payment is collected
• Trial data can be exported before the trial expires`
          },
          {
            title: '8. Disputed Charges',
            content: `If you believe you have been incorrectly charged:

1. Contact us first at getintelligen@gmail.com before initiating a chargeback
2. Provide details of the disputed charge
3. We commit to resolving billing disputes within 5 business days

Chargebacks
• We strongly discourage initiating chargebacks without first contacting us
• Unresolved chargebacks may result in account suspension
• Accounts with fraudulent chargeback claims will be permanently terminated
• Any costs incurred by us due to a chargeback may be passed on to you`
          },
          {
            title: '9. Upgrades and Downgrades',
            content: `Plan Upgrades
• You may upgrade your plan at any time
• Upgrades take effect immediately
• You will be charged the pro-rata difference for the remaining billing period

Plan Downgrades
• You may downgrade your plan at any time
• Downgrades take effect at the next billing cycle
• No refund is issued for the difference when downgrading mid-cycle
• Features not available in the lower plan will be inaccessible from the next billing date`
          },
          {
            title: '10. Contact for Refund Queries',
            content: `We are committed to resolving all refund and billing queries fairly and promptly.

IntelliGen Technologies
Email: getintelligen@gmail.com
Phone: +91 99620 48869
Website: intelligenapp.com

Business Hours: Monday – Saturday, 9:00 AM – 6:00 PM IST

We aim to respond to all refund queries within 1 business day and resolve them within 5–10 business days.`
          }
        ].map(section => (
          <div key={section.title} style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#38bdf8', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(56,189,248,0.2)' }}>
              {section.title}
            </h2>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '15px', lineHeight: '1.8', whiteSpace: 'pre-line' }}>
              {section.content}
            </div>
          </div>
        ))}

        <div style={{ marginTop: '48px', padding: '20px', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '12px', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
            © 2025 IntelliGen Technologies. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
            <a href='/privacy-policy' style={{ color: '#38bdf8', fontSize: '13px' }}>Privacy Policy</a>
            <a href='/terms' style={{ color: '#38bdf8', fontSize: '13px' }}>Terms of Service</a>
            <a href='/landing' style={{ color: '#38bdf8', fontSize: '13px' }}>Home</a>
          </div>
        </div>
      </div>
    </div>
  )
}