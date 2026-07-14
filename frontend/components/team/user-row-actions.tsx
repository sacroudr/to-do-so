"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { UserFormDialog } from "@/components/team/user-form-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteTeamMemberAction } from "@/lib/api/team-actions";
import { memberFullName } from "@/lib/team/name";
import type { TeamMember } from "@/lib/types/domain";

/**
 * Actions par ligne d'utilisateur (point 1) : edition + suppression.
 *
 * - Edition : crayon -> `UserFormDialog` en mode `edit`, PRE-REMPLI (coherent avec la
 *   creation et avec le crayon des cartes projet / tache).
 * - Suppression : corbeille (`--color-danger`) -> `ConfirmDialog` BLOQUANTE (action
 *   irreversible, cf. §8) : supprimer la personne la retire des taches ou elle etait
 *   responsable (cascade FK), sans supprimer aucune tache. On l'indique clairement.
 *
 * Le composant est monte par ligne dans la page Utilisateurs (Server Component) : seule
 * l'interactivite est cote client, la liste reste rendue cote serveur.
 */
export function UserRowActions({ member }: { member: TeamMember }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const fullName = memberFullName(member);

  function handleDelete(): void {
    startTransition(async () => {
      const result = await deleteTeamMemberAction(member.id);
      if (result.ok) {
        setConfirming(false);
        router.refresh();
        toast.success(`Utilisateur « ${fullName} » supprimé.`);
      } else {
        toast.error(result.error ?? "La suppression de l'utilisateur a échoué.");
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Modifier ${fullName}`}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <Pencil className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Supprimer ${fullName}`}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="size-4" />
      </button>

      <UserFormDialog
        open={editing}
        mode="edit"
        member={member}
        onClose={() => setEditing(false)}
      />

      <ConfirmDialog
        open={confirming}
        title="Supprimer l'utilisateur"
        message={`Cette action est irréversible. « ${fullName} » sera retiré(e) des tâches dont il/elle est responsable, sans qu'aucune tâche ne soit supprimée.`}
        confirmLabel="Supprimer"
        pending={pending}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
