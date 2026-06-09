interface GitIndicatorsProps {
  branch: string;
  dirty: boolean;
  uncommittedLabel: string;
}

export function GitIndicators({
  branch,
  dirty,
  uncommittedLabel,
}: GitIndicatorsProps) {
  return (
    <span className="git-indicators" aria-label={`${branch}${dirty ? `, ${uncommittedLabel}` : ""}`}>
      <span className="git-indicators-icon" aria-hidden>
        ⎇
      </span>
      <span className="git-indicators-branch">{branch}</span>
      {dirty && (
        <span className="git-indicators-dot" aria-hidden />
      )}
    </span>
  );
}
