interface SectionHeadingProps {
  title: string;
  showFilter?: boolean;
}

export default function SectionHeading({ title, showFilter }: SectionHeadingProps) {
  return (
    <div className="mb-6 flex items-end justify-between">
      <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
        {title}
      </h2>
      {showFilter && (
        <button className="text-lg font-medium text-accent transition-opacity hover:opacity-80 sm:text-xl">
          Filter
        </button>
      )}
    </div>
  );
}
