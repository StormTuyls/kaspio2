import { useState } from "react";
import type { Member } from "../types";
import { Modal } from "../components/Modal";
import { MemberForm } from "../components/MemberForm";

type Props = {
  members: Member[];
  currentUserId: string | null;
  onAdd: (values: { name: string; role: Member["role"] }) => void;
  onUpdate: (id: string, values: { name: string; role: Member["role"] }) => void;
  onDelete: (id: string) => void;
};

export function MembersView({ members, currentUserId, onAdd, onUpdate, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Leden</h2>
          <p className="text-sm text-gray-500">Admins en potjesbeheerders in je organisatie.</p>
        </div>
        <button onClick={() => setAdding(true)} className="btn-primary">
          + Lid toevoegen
        </button>
      </div>

      <ul className="divide-y divide-gray-100">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                {m.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{m.name}</span>
                  {m.id === currentUserId && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      jij
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {m.role === "admin" ? "Admin" : "Potjesbeheerder"}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(m)} className="btn-secondary text-sm">
                Bewerken
              </button>
              <button
                onClick={() => {
                  if (m.id === currentUserId) {
                    alert("Je kan jezelf niet verwijderen.");
                    return;
                  }
                  if (confirm(`Lid "${m.name}" verwijderen?`)) onDelete(m.id);
                }}
                className="btn-danger text-sm"
              >
                Verwijderen
              </button>
            </div>
          </li>
        ))}
      </ul>

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
