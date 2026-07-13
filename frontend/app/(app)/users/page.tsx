import { NewUserButton } from "@/components/team/new-user-button";
import { UserRowActions } from "@/components/team/user-row-actions";
import { getTeamMembers } from "@/lib/api/team";
import { memberFullName, memberInitials } from "@/lib/team/name";

/**
 * Utilisateurs = personnes assignables (`team_members`, point 2).
 *
 * Server Component : charge la liste via l'API. On affiche UNIQUEMENT prenom + nom
 * (PAS d'email, PAS de statut de compte) : ces personnes sont DECOUPLEES des comptes
 * Auth (qui peut se connecter != qui peut etre responsable). Le bouton « Nouvel
 * utilisateur » ouvre un formulaire minimal (prenom + nom), via Server Action.
 */
export default async function UsersPage() {
  const members = await getTeamMembers();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Utilisateurs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personnes pouvant être responsables d&apos;une tâche.
          </p>
        </div>
        <NewUserButton />
      </header>

      {members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aucun utilisateur pour le moment. Ajoutez-en un avec « Nouvel utilisateur ».
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {memberInitials(member) || "?"}
              </span>
              <span className="text-sm font-medium text-foreground">
                {memberFullName(member)}
              </span>
              <div className="ml-auto">
                <UserRowActions member={member} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
