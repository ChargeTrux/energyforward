/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

const LOGO_URL = 'https://energyforward.com/favicon.png'

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to the Energy Forward Investor Portal</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header */}
        <Section style={header}>
          <Img src={LOGO_URL} alt="Energy Forward" width="64" height="64" style={logo} />
          <Heading style={brandHeading}>Investor Portal</Heading>
          <Hr style={divider} />
        </Section>

        {/* Body */}
        <Section style={contentSection}>
          <Heading style={h1}>Welcome, Investor</Heading>
          <Text style={text}>
            You've been granted access to the{' '}
            <Link href={siteUrl} style={link}><strong>Energy Forward Investor Portal</strong></Link>.
            Please confirm your access below to set up your account and review
            your investor materials.
          </Text>
          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>
              Access Investor Portal
            </Button>
          </Section>
          <Text style={smallText}>
            If you weren't expecting this invitation, you can safely ignore this
            email.
          </Text>
        </Section>

        {/* Footer */}
        <Section style={footerSection}>
          <Hr style={footerDivider} />
          <Img src={LOGO_URL} alt="Energy Forward" width="40" height="40" style={footerLogo} />
          <Text style={footerBrand}>Energy Forward</Text>
          <Text style={footerRole}>Investor Relations</Text>

          <Text style={footerLine}>
            <strong>Website:</strong>{' '}
            <Link href="https://energyforward.com" style={footerLink}>energyforward.com</Link>
          </Text>
          <Text style={footerLine}>
            <strong>Investor Portal:</strong>{' '}
            <Link href="https://energyforward.com/p/investor" style={footerLink}>energyforward.com/p/investor</Link>
          </Text>
          <Text style={footerLine}>
            <strong>Support:</strong>{' '}
            <Link href="mailto:support@energyforward.com" style={footerLink}>support@energyforward.com</Link>
          </Text>

          <Hr style={footerDivider} />
          <Text style={securityText}>This email was sent securely by Energy Forward.</Text>
          <Text style={securityText}>
            Energy Forward will never ask for your password by email.
          </Text>
          <Text style={copyright}>© 2026 Energy Forward. All rights reserved.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = {
  backgroundColor: '#F8FAFC',
  fontFamily: 'Arial, Helvetica, sans-serif',
  margin: 0,
  padding: '24px 0',
}
const container = {
  backgroundColor: '#ffffff',
  maxWidth: '600px',
  margin: '0 auto',
  borderRadius: '12px',
  overflow: 'hidden' as const,
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
}
const header = {
  backgroundColor: '#ffffff',
  padding: '32px 24px 16px',
  textAlign: 'center' as const,
}
const logo = { margin: '0 auto', display: 'block' }
const brandHeading = {
  fontSize: '18px',
  fontWeight: '600' as const,
  color: '#0F172A',
  letterSpacing: '0.5px',
  margin: '16px 0 0',
  textAlign: 'center' as const,
}
const divider = {
  border: 'none',
  borderTop: '1px solid #E2E8F0',
  margin: '24px 24px 0',
}
const contentSection = { padding: '32px 32px 24px' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#0F172A',
  margin: '0 0 16px',
}
const text = {
  fontSize: '15px',
  color: '#334155',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const link = { color: '#2563EB', textDecoration: 'underline' }
const buttonWrap = { textAlign: 'center' as const, margin: '8px 0 24px' }
const button = {
  backgroundColor: '#2563EB',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '10px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
}
const smallText = {
  fontSize: '13px',
  color: '#64748B',
  lineHeight: '1.5',
  margin: '16px 0 0',
}
const footerSection = {
  backgroundColor: '#F8FAFC',
  padding: '24px 24px 32px',
  textAlign: 'center' as const,
}
const footerDivider = {
  border: 'none',
  borderTop: '1px solid #E2E8F0',
  margin: '0 0 20px',
}
const footerLogo = { margin: '0 auto 8px', display: 'block' }
const footerBrand = {
  fontSize: '14px',
  fontWeight: 'bold' as const,
  color: '#0F172A',
  margin: '0',
  textAlign: 'center' as const,
}
const footerRole = {
  fontSize: '12px',
  color: '#64748B',
  margin: '2px 0 16px',
  textAlign: 'center' as const,
}
const footerLine = {
  fontSize: '12px',
  color: '#475569',
  margin: '4px 0',
  textAlign: 'center' as const,
}
const footerLink = { color: '#2563EB', textDecoration: 'none' }
const securityText = {
  fontSize: '11px',
  color: '#64748B',
  margin: '4px 0',
  textAlign: 'center' as const,
}
const copyright = {
  fontSize: '11px',
  color: '#94A3B8',
  margin: '16px 0 0',
  textAlign: 'center' as const,
}
