import { getSession } from "@/lib/session";
import { ONBOARDING_TEMPLATE } from "@/lib/template";
import OnboardingForm from "@/components/OnboardingForm";

export default async function Home() {
  const session = await getSession();
  return (
    <main className="shell">
      <OnboardingForm
        signedIn={Boolean(session.accessToken)}
        account={session.account ?? null}
        sessionCount={ONBOARDING_TEMPLATE.length}
      />
    </main>
  );
}
