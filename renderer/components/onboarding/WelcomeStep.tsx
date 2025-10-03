interface WelcomeStepProps {
    onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
    return (
        <div className="flex flex-col items-center justify-center text-center px-8">
            <div className="mb-8">
                <svg
                    className="w-32 h-32 mx-auto text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                    />
                </svg>
            </div>

            <h1 className="text-4xl font-bold text-white mb-4">
                Welcome to Akagaku!
            </h1>

            <p className="text-lg text-gray-300 mb-8 max-w-md">
                Your personal desktop character powered by AI.
                Let's set up your character in just a few steps.
            </p>

            <button
                onClick={onNext}
                className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-lg font-semibold"
            >
                Get Started
            </button>
        </div>
    );
}
