<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Scope estimate-specific mobile layout behavior through the estimates route and filter scope; shared screens must retain their existing behavior.
- Estimate image carousels use card-local Embla navigation and the same ordered paths as the lightbox, keeping image changes independent of weight-entry state.
- Use the estimate-only preview dialog for compact inspection; leave the shared image lightbox unchanged so other sections retain their viewing behavior.
