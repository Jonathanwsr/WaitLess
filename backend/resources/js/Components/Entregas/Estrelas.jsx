import { StarIcon } from '@heroicons/react/24/solid';

export default function Estrelas({ valor, onChange, tamanho = 'w-6 h-6' }) {
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
                <button
                    key={n}
                    type="button"
                    onClick={() => onChange?.(n)}
                    disabled={!onChange}
                    aria-label={`${n} estrelas`}
                    className="disabled:cursor-default"
                >
                    <StarIcon className={`${tamanho} ${n <= valor ? 'text-amber-400' : 'text-zinc-200'}`} />
                </button>
            ))}
        </div>
    );
}
