import { useState, useEffect, useRef } from "react";
import { OverlayMenu } from "./OverlayMenu";
import { CharacterDisplayProperties, CharacterProperties, TouchablePathProps } from "@shared/types";

const TouchablePath = ({ path, onTouch, onClick, onMouseLeave }: TouchablePathProps) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const handleMouseEnter = () => {
        timeoutRef.current = setTimeout(() => {
            onTouch();
        }, 1000);
    }

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        onMouseLeave();
    }

    const handleMouseDown = () => {
        onClick();
    }
    
    return (
        <path className="touchable-area-path" d={path} style={{ fill: 'transparent' }} onMouseEnter={() => handleMouseEnter()} onMouseLeave={() => handleMouseLeave()} onMouseDown={() => handleMouseDown()}/>
    )
}

export default function Character({ character_name, character_width, character_height, imgSrc, touchable_areas, displayScale = 1.0 }: CharacterDisplayProperties & { displayScale?: number }) {
    const [isHovered, setIsHovered] = useState(false);

    const [isTouched, setIsTouched] = useState(false);
    const [lastUserAction, setLastUserAction] = useState("");

    const handleMouseEnter = () => {
        setIsHovered(true);
    }

    const handleMouseLeave = () => {
        setIsHovered(false);

    }

    useEffect(() => {
        if (lastUserAction !== "") {
            window.ipc.send('user-message', { input: lastUserAction, isSystemMessage: false });
        }
    }, [lastUserAction]);

    const handleUserTouchEvent = (bodyPart: string, started: boolean) => {
        console.log(bodyPart, started)
        const touchEvent = touchable_areas.find(area => area.bodyPart === bodyPart)?.action_event.touch;
        if (touchEvent && touchEvent !== lastUserAction) {
            setIsTouched(true);
            setLastUserAction(touchEvent);
        }
    }

    const handleBodyPartMouseLeave = () => {
        setLastUserAction("");
    }

    const handleUserClickEvent = (bodyPart: string) => {
        const clickEvent = touchable_areas.find(area => area.bodyPart === bodyPart)?.action_event.click;
        if (clickEvent && clickEvent !== lastUserAction) {
            setIsTouched(true);
            setLastUserAction(clickEvent);
        }
    }

    return (
        <div className="character inline-block relative right-0 bottom-0" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            {isHovered && <OverlayMenu displayScale={displayScale} />}
            {touchable_areas &&
                <svg className="absolute top-0 left-0 z-1" viewBox={`0 0 ${character_width} ${character_height}`}>
                    {touchable_areas.map((area, i) => (
                        <g key={`${area.bodyPart}-${i}`}>
                        {area.paths.map((path, index) => (
                            <TouchablePath path={path} onTouch={() => handleUserTouchEvent(area.bodyPart, true)} onMouseLeave={handleBodyPartMouseLeave} onClick={() => handleUserClickEvent(area.bodyPart)} key={`${area.bodyPart}-${index}`}/>
                            ))}
                        </g>
                    ))}
                </svg>
            }
            <img src={`${imgSrc}`} style={{ width: '100%', height: '100%' }} />
        </div>
    )
}