import { useState } from "react";
import type { Member } from "../types";
import { Modal } from "../components/Modal";
import { useAlert, useConfirm } from "../components/ConfirmDialog";
import { MemberForm } from "../components/MemberForm";
import { Avatar } from "./Overview";

type Props = {
  members: Member[];
  currentUserId: string | null;
  onAdd: (values: { name: string; role: Member["role"] }) => void;
  onUpdate: (id: string, values: { name: string; role: Member["role"] }) => void;
  onDelete: (id: string) => void;
};

export function MembersView({ members, currentUserId, onAdd, onUpdate, onDelete }: Props) {
  const confirm = useConfirm();
  const alert = useAlert();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zacht">
            Organisatie
          </p>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Leden</h1>
          <p className="mt-1 text-sm text-basis">
            Admins en potjesbeheerders binnen je organisatie.
          </p>
        </div>
        <button onClick={() => setAdding(true)} className="btn-accent">
          + Lid toevoegen
        </button>
      </div>

      <div className="card overflow-hidden">
        <ul className="divide-y divide-ink-200 dark:divide-ink-800/60">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex flex-col gap-3 px-5 py-4 transition hover:bg-ink-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-ink-900/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={m.name} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-sterk">
                      {m.name}
                    </span>
                    {m.id === currentUserId && (
                      <span className="rounded-full bg-in-100 px-2 py-0.5 text-xs font-semibold text-in-600 dark:bg-in-700/30 dark:text-in-400">
                        jij
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zacht">
                    {m.role === "admin" ? "Admin" : "Potjesbeheerder"}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 sm:flex-shrink-0">
                <button
                  onClick={() => setEditing(m)}
                  className="btn-secondary flex-1 text-sm sm:flex-initial"
                >
                  Bewerken
                </button>
                <button
                  onClick={async () => {
                    if (m.id === currentUserId) {
                      await alert({ title: "Je kan jezelf niet verwijderen." });
                      return;
                    }
                    if (await confirm({ title: `Lid "${m.name}" verwijderen?`, confirmLabel: "Verwijderen", danger: true }))
                      onDelete(m.id);
                  }}
                  className="btn-danger flex-1 text-sm sm:flex-initial"
                >
                  Verwijderen
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Modal open={adding} title="Nieuw lid" onClose={() => setAdding(false)}>
        <MemberForm
          onSubmit={(values) => {
            onAdd(values);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      </Modal>

      <Modal open={!!editing} title="Lid bewerken" onClose={() => setEditing(null)}>
        {editing && (
          <MemberForm
            initial={editing}
            onSubmit={(values) => {
              onUpdate(editing.id, values);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}
