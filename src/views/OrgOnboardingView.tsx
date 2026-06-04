import { Mark } from "../components/Logo";
import { CreateOrgForm } from "../components/CreateOrgForm";
import { signOut } from "../supabase";

type Props = {
  fullName: string;
  onCreate: (name: string) => Promise<{ error: string | null }>;
};

/**
 * Toont wanneer een ingelogde user nog geen organisatie heeft.
 */
export function OrgOnboardingView({ fullName, onCreate }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 dark:bg-navy-950">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <Mark size={36} />
          <span className="text-lg font-bold text-navy-900 dark:text-white">
            Kaspio
          </span>
        </div>

        <div className="card p-7">
          <CreateOrgForm
            title={`Welkom ${fullName.split(" ")[0]}!`}
            description="Voor je begint, maak je eerste organisatie aan. Je kunt er later leden bij uitnodigen of een tweede organisatie maken."
            onCreate={onCreate}
          />
        </div>

        <p className="mt-6 text-center text-xs text-navy-400">
          Liever uitloggen?{" "}
          <button
            onClick={() => signOut()}
            className="font-medium text-navy-700 hover:underline dark:text-navy-200"
          >
            Klik hier
          </button>
        </p>
      </div>
    </div>
  );
}
