interface Props {
  caseId: string
  caseName: string
  onSelect: (caseId: string) => void
}

export function CaseChip({ caseId, caseName, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(caseId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(caseId)
        }
      }}
      className="inline-flex items-center px-1.5 py-px mx-0.5 border-b border-dotted border-accent-data text-accent-data hover:bg-accent-data/10 focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent-data"
    >
      {caseName}
    </button>
  )
}
