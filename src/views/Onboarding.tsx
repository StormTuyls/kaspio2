import { useState } from "react";
import type { FormEvent } from "react";

type Props = {
  onCreate: (name: string) => void;
};

export function Onboarding({ onCreate }: Props) {
  const [name, setName] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <h2 className="mb-1 text-xl font-bold text-gray-900">Welkom!</h2>
      <p className="mb-6 text-sm text-gray-500">
        Maak eerst de organisatie-admin aan. Daarna kan je potjesbeheerders toevoegen en potjes
        aanmaken.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Jouw naam *</span>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bijv. Jan Janssens"
            className="input"
            required
          />
        </label>
        <button type="submit" className="btn-primary w-full">
          Admin aanmaken en starten
        </button>
      </form>
    </div>
  );
}
