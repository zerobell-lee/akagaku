import { useState } from "react";
import { FaEye } from "react-icons/fa";
import { FaEyeSlash } from "react-icons/fa";

export type SecretInputProps = {
    value: string;
    onChange: (value: string) => void;
}

export const SecretInput = ({ value, onChange }: SecretInputProps) => {
    const [isMasked, setIsMasked] = useState(true);

    return (
        <div className="secret-input flex gap-2 text-black">
            <input className="w-full text-black" type={isMasked ? 'password' : 'text'} value={value} onChange={(e) => onChange(e.target.value)} style={{ color: 'black' }} />
            <div className="flex items-center justify-center cursor-pointer fx-2" onClick={() => setIsMasked(!isMasked)}>
                {isMasked ? <FaEye style={{ width: 30, height: 30 }} /> : <FaEyeSlash style={{ width: 30, height: 30 }} />}
            </div>
        </div>
    )
}