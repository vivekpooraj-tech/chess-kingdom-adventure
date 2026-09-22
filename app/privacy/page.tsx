import Link from "next/link";
import { Screen } from "@/components/layout/Screen";
import { Logo } from "@/components/branding/Logo";
import { TEXT } from "@/lib/designSystem";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: `Privacy Policy · ${BRAND.name}`,
  description: `How ${BRAND.name} collects, uses, and protects information.`,
};

/**
 * Public, unauthenticated page (see PUBLIC_PATHS in middleware.ts).
 *
 * Describes ONLY what the current implementation actually does — no
 * analytics, no advertising, no subscriptions, no self-service account
 * deletion, no screen-time enforcement. See Phase 3.2's read-only
 * inspection for the source-level basis of every claim here. If the
 * product changes, this page has to change with it — it is not
 * boilerplate copied from elsewhere.
 */

const H2 = `${TEXT.heading} mt-10 mb-3`;
const P = `${TEXT.body} mb-4`;
const LI = `${TEXT.body} mb-2 ml-5 list-disc`;

const CONTACT_EMAIL = "support@chessmind.club";

export default function PrivacyPolicyPage() {
  return (
    <Screen maxWidth="compact">
      <header className="w-full flex flex-col items-center gap-4 pt-4 pb-2 text-center">
        <Link href="/" aria-label={`${BRAND.name} home`}>
          <Logo variant="compact" size={40} />
        </Link>
        <h1 className={TEXT.display}>Privacy Policy</h1>
        <p className={TEXT.caption}>Last updated: September 2026</p>
      </header>

      <div className="w-full pb-16">
        <p className={P}>
          This Privacy Policy explains what information {BRAND.name} collects, how it is used, and the
          choices available to parents and account holders. {BRAND.name} is a chess learning and play
          app aimed at children, used under a parent or guardian&apos;s account.
        </p>

        <h2 className={H2}>Who {BRAND.name} Is</h2>
        <p className={P}>
          {BRAND.name} ({BRAND.tagline}) is a chess education and play product. A parent or guardian
          creates the account and sets up one or more child profiles under it. This policy covers the{" "}
          {BRAND.name} website and the {BRAND.name} Android app, which loads the same website inside the
          app.
        </p>

        <h2 className={H2}>Information We Collect</h2>

        <h3 className={`${TEXT.subheading} mt-6 mb-2`}>Parent / account information</h3>
        <ul>
          <li className={LI}>Email address, used to sign in and for account-related communication.</li>
          <li className={LI}>
            Authentication information handled by our authentication provider (see &ldquo;Authentication&rdquo;
            below) — we do not receive or store your password in readable form.
          </li>
          <li className={LI}>Premium/payment status (whether the account has purchased Premium or Chess School access).</li>
          <li className={LI}>
            Stripe checkout session references, used to confirm and reconcile a completed purchase — see
            &ldquo;Payment Information&rdquo; below.
          </li>
        </ul>

        <h3 className={`${TEXT.subheading} mt-6 mb-2`}>Child profile information</h3>
        <p className={P}>
          A child profile is created and managed by the parent, under the parent&apos;s account. A child
          profile includes:
        </p>
        <ul>
          <li className={LI}>A display name chosen for the profile (not required to be a real name).</li>
          <li className={LI}>An avatar and companion character selected from a fixed set built into the app.</li>
          <li className={LI}>A coarse age band / experience level selected during setup, used to tailor lesson difficulty.</li>
          <li className={LI}>Screen-time preferences a parent sets for that child (see &ldquo;Screen Time&rdquo; below).</li>
        </ul>
        <p className={P}>
          We do not ask for or knowingly collect a child&apos;s exact date of birth, email address, phone
          number, precise location, biometric information, payment information, or an uploaded photograph
          of the child.
        </p>

        <h3 className={`${TEXT.subheading} mt-6 mb-2`}>Gameplay and learning information</h3>
        <p className={P}>
          As a child profile is used, we record what is necessary to make the product work and to show
          real progress: lesson and course progress, puzzles solved and accuracy, chess games played and
          their results, a numeric chess rating, and achievements/badges earned. This information is
          tied to the child profile, which is tied to the parent&apos;s account.
        </p>

        <h3 className={`${TEXT.subheading} mt-6 mb-2`}>Payment information</h3>
        <p className={P}>
          Payments are processed by Stripe through a Stripe-hosted checkout page. {BRAND.name} does not
          receive or store your card number, CVV, or other raw card details — those are handled entirely
          by Stripe. We store a Stripe checkout session reference and payment status so we can confirm a
          purchase actually went through and grant the correct access.
        </p>

        <h3 className={`${TEXT.subheading} mt-6 mb-2`}>Device / technical information</h3>
        <p className={P}>
          Our hosting and infrastructure providers (see &ldquo;Data Sharing&rdquo; below) may log standard
          technical request information (such as IP address and request timing) as part of normally
          operating a web service. {BRAND.name}&apos;s own application code does not add any separate
          analytics, advertising, or tracking layer on top of this.
        </p>

        <h2 className={H2}>Cookies, localStorage, and sessionStorage</h2>
        <p className={P}>We use browser storage only to make the product function, never for advertising or cross-site tracking:</p>
        <ul>
          <li className={LI}>
            <strong>Session cookies</strong>, set by our authentication provider, keep you signed in.
          </li>
          <li className={LI}>
            <strong>An &ldquo;active child&rdquo; cookie</strong> remembers which child profile is currently
            selected on a device.
          </li>
          <li className={LI}>
            <strong>localStorage</strong> stores on-device preferences and progress such as your chosen
            visual theme and mode, board/piece customization, a parent-lock PIN (stored only as a hash,
            never in plain text), recently-seen puzzles, and course-resume position — so the app feels
            consistent on that device without needing a server round trip for every small preference.
          </li>
          <li className={LI}>
            <strong>sessionStorage</strong> holds a small amount of short-lived state, such as whether a
            one-time welcome screen has already been shown in the current browser session.
          </li>
        </ul>
        <p className={P}>
          None of this browser storage is used to build an advertising profile, and none of it is shared
          with an advertising network — because {BRAND.name} does not use one.
        </p>

        <h2 className={H2}>How Information Is Used</h2>
        <ul>
          <li className={LI}>To create and operate parent and child accounts.</li>
          <li className={LI}>To run the chess lessons, puzzles, games, matchmaking, and rating features.</li>
          <li className={LI}>To let a parent see a child&apos;s progress and set screen-time preferences.</li>
          <li className={LI}>To process purchases and grant the access that was paid for.</li>
          <li className={LI}>To operate, secure, and troubleshoot the service.</li>
        </ul>

        <h2 className={H2}>Authentication</h2>
        <p className={P}>
          Sign-in is handled by Supabase Authentication, supporting email-and-password sign-in and
          Google sign-in. We do not offer Apple, Facebook, or phone-number sign-in today. If you sign in
          with Google, Google shares the account information you approve (such as your email address)
          with our authentication provider to complete sign-in — we do not separately collect additional
          data from your Google account.
        </p>

        <h2 className={H2}>Payments and Stripe</h2>
        <p className={P}>
          All payments are one-time purchases processed by Stripe through Stripe&apos;s own hosted
          checkout page — {BRAND.name} does not currently offer a recurring subscription. Stripe&apos;s
          own privacy practices govern the payment details you enter on that page; please refer to
          Stripe&apos;s privacy policy for how Stripe itself handles that information.
        </p>

        <h2 className={H2}>Supabase Processing</h2>
        <p className={P}>
          {BRAND.name} uses Supabase to store account, profile, and gameplay data, to authenticate sign-in,
          and to power real-time features (such as live matchmaking and live game updates). Supabase acts
          as our database and infrastructure provider for this data.
        </p>

        <h2 className={H2}>Data Sharing / Service Providers</h2>
        <p className={P}>
          We share information only with the service providers that operate {BRAND.name} itself:
        </p>
        <ul>
          <li className={LI}><strong>Supabase</strong> — authentication, database, and real-time infrastructure.</li>
          <li className={LI}><strong>Stripe</strong> — payment processing, via Stripe&apos;s hosted checkout.</li>
          <li className={LI}>Our hosting/deployment provider, to serve the website and app.</li>
        </ul>
        <p className={P}>
          We do not sell personal information, and we do not share it with advertising or marketing
          third parties — {BRAND.name} does not use any advertising or marketing-analytics service.
        </p>

        <h2 className={H2}>Parental Control Context</h2>
        <p className={P}>
          {BRAND.name} is designed to be set up and supervised by a parent or guardian. The parent
          account is the one that signs in, creates child profiles, sets screen-time preferences, and
          manages any purchase. A child does not create or control the account independently.
        </p>

        <h2 className={H2}>Screen Time</h2>
        <p className={P}>
          A parent can set weekday and weekend screen-time preferences for a child profile from the
          parent dashboard, and those preferences are saved. At present, {BRAND.name} does not actively
          enforce those limits by blocking or restricting play once a set time is reached — the feature
          currently records your preference rather than acting on it. We describe it this way so it is
          not mistaken for an active parental control.
        </p>

        <h2 className={H2}>Data Retention</h2>
        <p className={P}>
          We keep account, profile, and gameplay information for as long as the account exists, so that
          progress, ratings, and history remain available to you. If an account is deleted (see below),
          we remove or anonymize the associated data, subject to what our service providers and
          applicable law require us to retain (for example, payment records Stripe or accounting
          obligations may require us to keep for a period after a purchase).
        </p>

        <h2 className={H2}>Account / Data Deletion Requests</h2>
        <p className={P}>
          {BRAND.name} does not currently have a self-service &ldquo;delete my account&rdquo; button in the
          app. To request deletion of a parent account, a child profile, or associated data, please
          contact us at{" "}
          <span className="font-semibold text-premium-gold">{CONTACT_EMAIL}</span> from the email address
          associated with the account, and we will act on your request.
        </p>

        <h2 className={H2}>Security</h2>
        <p className={P}>
          We rely on our authentication and database provider&apos;s security controls (including
          encrypted connections and access controls scoped to each account) to protect information in
          transit and at rest. No online service can guarantee perfect security, but we take reasonable,
          industry-standard steps to protect the information described in this policy.
        </p>

        <h2 className={H2}>Children&apos;s Privacy</h2>
        <p className={P}>
          {BRAND.name} is built for children to use under a parent or guardian&apos;s account and
          supervision. We intentionally limit what a child profile collects: no real name is required, no
          child email or phone number, no precise location, no biometric data, no payment information,
          and no uploaded photograph. A parent controls the account that a child profile lives under,
          including its screen-time preferences and any purchase. If you are a parent and believe your
          child has provided us with more information than described here, please contact us using the
          details below so we can review and correct it.
        </p>

        <h2 className={H2}>International Processing</h2>
        <p className={P}>
          {BRAND.name}&apos;s infrastructure and service providers may process and store information in
          countries other than the one you live in. We have not made a formal legal determination about
          which specific international data-transfer framework applies to {BRAND.name}, and this policy
          does not claim compliance with any particular regional data-protection law unless stated
          explicitly elsewhere. If your use of {BRAND.name} requires a specific legal basis for
          international transfer, please contact us.
        </p>

        <h2 className={H2}>Changes to This Privacy Policy</h2>
        <p className={P}>
          We may update this Privacy Policy as {BRAND.name} changes. We will update the &ldquo;Last
          updated&rdquo; date above when we do. If a change is significant, we will make reasonable
          efforts to bring it to your attention.
        </p>

        <h2 className={H2}>Contact</h2>
        <p className={P}>
          Questions about this Privacy Policy, or a request related to your data, can be sent to{" "}
          <span className="font-semibold text-premium-gold">{CONTACT_EMAIL}</span>.
        </p>

        <div className="mt-12 pt-6 border-t border-white/10 flex items-center justify-center gap-6">
          <Link
            href="/"
            className="inline-flex items-center min-h-[44px] font-body text-sm text-premium-ivory/65 underline underline-offset-2"
          >
            Back to Home
          </Link>
          <Link
            href="/terms"
            className="inline-flex items-center min-h-[44px] font-body text-sm text-premium-ivory/65 underline underline-offset-2"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </Screen>
  );
}
