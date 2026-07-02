"""Verification des tokens Supabase (dossier dedie, requirements.md §6.2).

Toute la logique de validation du JWT emis par Supabase Auth vit ici. Le reste de
l'API depend de ce module via `app.api.deps.get_current_user`.
"""
