import Link from "next/link";
import { Screen } from "@/components/layout/Screen";
import { Logo } from "@/components/branding/Logo";
import { TEXT } from "@/lib/designSystem";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: `Terms of Service · ${BRAND.name}`,
  description: `The terms that govern use of ${BRAND.name}.`,
};

/**
 * Public, unauthenticated page (see PUBLIC_PATHS in middleware.ts).
 *
 * Describes ONLY what the current implementation actually does. No
 * recurring-subscription language (payments are one-time, per
 * lib/premium — see Phase 3.2's read-only inspection), no refund
 * promise (no documented refund policy exists to describe), no
 * self-service account deletion. Keep this file in sync with the
 * product, not the other way around.
 */

const H2 = `${TEXT.heading} mt-10 mb-3`;
const P = `${TEXT.body} mb-4`;
const LI = `${TEXT.body} mb-2 ml-5 list-disc`;

const CONTACT_EMAIL = "support@chessmind.club";

export default function TermsOfServicePage() {
  return (
    <Screen maxWidth="compact">
      <header className="w-full flex flex-col items-center gap-4 pt-4 pb-2 text-center">
        <Link href="/" aria-label={`${BRAND.name} home`}>
          <Logo variant="compact" size={40} />
        </Link>
        <h1 className={TEXT.display}>Terms of Service</h1>
        <p className={TEXT.caption}>Last updated: September 2026</p>
      </header>

      <div className="w-full pb-16">
        <p className={P}>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of {BRAND.name} —
          the website and the {BRAND.name} Android app, which loads the same website. By creating an
          account or using {BRAND.name}, you agree to these Terms.
        </p>

        <h2 className={H2}>Acceptance</h2>
        <p className={P}>
          By creating a {BRAND.name} account, setting up a child profile, or otherwise using the service,
          you agree to be bound by these Terms and by our{" "}
          <Link href="/privacy" className="text-premium-gold underline underline-offset-2">
            Privacy Policy
          </Link>
          . If you do not agree, please do not use {BRAND.name}.
        </p>

        <h2 className={H2}>Eligibility / Parent Responsibility</h2>
        <p className={P}>
          {BRAND.name} is intended to be used by children under the account and supervision of a parent
          or legal guardian. The parent or guardian who creates the account is responsible for the account,
          for the child profile(s) created under it, for any purchase made through it, and for reviewing
          these Terms and the Privacy Policy before allowing a child to use the service.
        </p>

        <h2 className={H2}>Accounts</h2>
        <p className={P}>
          You are responsible for keeping your account credentials secure and for all activity that
          occurs under your account. Sign-in is provided via email-and-password or Google sign-in. You
          agree to provide accurate information when creating your account.
        </p>

        <h2 className={H2}>Child Profiles</h2>
        <p className={P}>
          A child profile is created and managed by the parent account, not independently by the child.
          A parent chooses the display name, avatar, and companion character for a profile, sets its
          screen-time preferences, and can view its progress. The parent remains responsible for the use
          of each child profile created under their account.
        </p>

        <h2 className={H2}>Acceptable Use</h2>
        <p className={P}>You agree not to:</p>
        <ul>
          <li className={LI}>Use {BRAND.name} for any unlawful purpose, or in a way that could harm another user, especially another child.</li>
          <li className={LI}>Attempt to access another account or child profile that is not your own.</li>
          <li className={LI}>Attempt to disrupt, reverse engineer, or interfere with the normal operation of the service.</li>
          <li className={LI}>Use automated means (bots, scripts) to play games, solve puzzles, or otherwise interact with the service in a way it is not intended to be used.</li>
        </ul>

        <h2 className={H2}>{BRAND.name} Content and Intellectual Property</h2>
        <p className={P}>
          The {BRAND.name} name, logo, lesson content, puzzle content, illustrations, and software are
          owned by {BRAND.name} or its licensors and are protected by applicable intellectual property
          law. You may use them only as part of normal use of the service. You may not copy, redistribute,
          or create derivative works from {BRAND.name}&apos;s content outside of normal personal use of
          the app, without our written permission.
        </p>
        <p className={P}>
          The rules of chess itself are not owned by anyone; nothing in these Terms restricts your ability
          to play or teach chess outside of {BRAND.name}.
        </p>

        <h2 className={H2}>Games and Gameplay</h2>
        <p className={P}>
          {BRAND.name} includes games played against a computer opponent and games played against other
          {BRAND.name} players via matchmaking or a friend invite. Free accounts are subject to daily
          usage limits on computer games and multiplayer games, as shown in the app. Chess ratings shown
          in the app are calculated from games played through {BRAND.name} and are specific to{" "}
          {BRAND.name} — they are not an official or portable chess rating.
        </p>

        <h2 className={H2}>Payments and Purchases</h2>
        <p className={P}>
          Some content and features (such as unlimited daily games or the full Chess School course)
          require a one-time purchase, processed by Stripe through a Stripe-hosted checkout page.{" "}
          {BRAND.name} does not currently offer or charge a recurring subscription. Prices are shown at
          checkout before you pay. You are responsible for charges made through your account.
        </p>
        <p className={P}>
          {BRAND.name} does not currently have a documented refund policy published anywhere in the
          product. If you believe you were charged in error, contact us at{" "}
          <span className="font-semibold text-premium-gold">{CONTACT_EMAIL}</span> and we will review your
          request individually — this is not a guarantee of a refund.
        </p>

        <h2 className={H2}>Service Availability</h2>
        <p className={P}>
          We aim to keep {BRAND.name} available and working correctly, but we do not guarantee
          uninterrupted or error-free service. Features may change, be added, or be removed as the
          product develops.
        </p>

        <h2 className={H2}>Third-Party Services</h2>
        <p className={P}>
          {BRAND.name} relies on third-party services to operate — currently Supabase (authentication,
          database, and real-time features) and Stripe (payment processing). Your use of features that
          depend on these providers is also subject to those providers&apos; own terms where applicable.
        </p>

        <h2 className={H2}>Account Termination / Suspension</h2>
        <p className={P}>
          We may suspend or terminate an account that violates these Terms, that we reasonably believe is
          being used to harm another user (especially another child), or where required to comply with
          the law. You may request that your account be closed by contacting us — see &ldquo;Account /
          Data Deletion Requests&rdquo; in the Privacy Policy, since {BRAND.name} does not currently
          offer self-service account deletion inside the app.
        </p>

        <h2 className={H2}>Disclaimers</h2>
        <p className={P}>
          {BRAND.name} is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties
          of any kind, express or implied, to the fullest extent permitted by law. We do not warrant that
          the service will be error-free, secure, or uninterrupted, or that lesson content is complete or
          suitable for every learner.
        </p>

        <h2 className={H2}>Limitation of Liability</h2>
        <p className={P}>
          To the fullest extent permitted by law, {BRAND.name} and its operators will not be liable for
          any indirect, incidental, special, or consequential damages arising from your use of the
          service. Our total liability for any claim relating to {BRAND.name} will not exceed the amount
          you paid us, if any, in the twelve months before the claim.
        </p>

        <h2 className={H2}>Changes to These Terms</h2>
        <p className={P}>
          We may update these Terms as {BRAND.name} changes. We will update the &ldquo;Last updated&rdquo;
          date above when we do. Continued use of {BRAND.name} after a change means you accept the
          updated Terms.
        </p>

        <h2 className={H2}>Contact</h2>
        <p className={P}>
          Questions about these Terms can be sent to{" "}
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
            href="/privacy"
            className="inline-flex items-center min-h-[44px] font-body text-sm text-premium-ivory/65 underline underline-offset-2"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </Screen>
  );
}
