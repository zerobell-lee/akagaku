import { useState, useEffect, useCallback, useRef } from "react";
import { OverlayMenu } from "./OverlayMenu";
import { throttle } from 'lodash';

export type Emoticon = "neutral" | "happy" | "sad" | "angry" | "embarassed" | "surprised" | "smile"

interface TouchableArea {
    bodyPart: string;
    paths: string[];
    action_event: {
        touch: string | undefined;
        click: string | undefined;
    };
}

interface TouchablePathProps {
    path: string;
    onTouch: () => void | undefined;
    onClick: () => void | undefined;
    key: string;
}

const TouchablePath = ({ path, onTouch, onClick, key }: TouchablePathProps) => {
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
    }

    const handleMouseDown = () => {
        onClick();
    }
    
    return (
        <path className="touchable-area-path" key={key} d={path} style={{ fill: 'transparent' }} onMouseEnter={() => handleMouseEnter()} onMouseLeave={() => handleMouseLeave()} onMouseDown={() => handleMouseDown()}/>
    )
}

export default function Character({ emoticon = "neutral" }: { emoticon?: Emoticon }) {
    const [isHovered, setIsHovered] = useState(false);

    const [isTouched, setIsTouched] = useState(false);
    const [lastUserAction, setLastUserAction] = useState("");

    const handleMouseEnter = () => {
        setIsHovered(true);
    }

    const handleMouseLeave = () => {
        setIsHovered(false);
    }

    const touchable_areas = [
        {
            "bodyPart": "head",
            "paths": [
                "M263.9,32.03c.25.18.41,2.43,1.16,3.34,5.43,6.56,2.68,3.68,5.45,10.58.69,1.72,13.72,18.9,16.05,21.95,1.25,1.64,3.65,2.22,5.26,4.74,3.76,5.89,12.95,36.38,11.97,42.65-.27,1.72-2.69,4.12-3.4,6.63-1.64,5.85-1.4,15.44-2.87,20.12-1.59,5.06-13.77,18.34-18.05,21.94-2.69,2.26-7.08,9.38-9,3.97-1.68-.03-5.42,5.61-6.49,1.48-.72-2.75,12.52-20.19,8.98-26.45-1.5.45-5.03,5.38-6.49,3l-6.17-27.82-8.83-18.17c-.02,5.84-4.45,12.9-5.32,17.76-.35,1.95.72,4.63.34,5.28s-2.43,1.22-3.38,2.59c-3.17,4.56-4.48,12.87-12.12,11.36l3.98-10.51-1.97-.48c-5.71,12.11-19.79,19.66-33.01,18.98l1.89-3.63-.87-1.88-4.02-.47c2.26-11.72,3.54-23.72,1.01-35.5-.29-1.36.12-2.52-1.5-3.48l-7.48,14.49c2.03,1.63,3.65,1.24,2.98,4.48-6.89-1.15-8.99,6.02-13.49,10.02-3.15,2.8-10.2,7.15-14.29,7.8-2.95.47-5.44-1.75-8.22,1.69-1.61,2-1,4.07-1.02,6.48h6c.55,4.01-3.92,5.48-5.75,8.48l3.75,6.51c-3.65-.65-6.19-1.46-9.85-.08-4.01-7.13-12.54-11.75-14.5-20.14-4.36-18.66-4.21-41.11,2.34-59.28,1.76-4.89,7.92-14.17,8.48-17.37.65-3.64-2.9-18.06-2.33-23.66.29-2.81,2.75-6.74,2.34-10.46,17.71-10.75,37.55-13.72,58.05-13.02,14.19.48,28.75,2.47,41.81,8.18,3.24,1.42,13.44,8.48,14.26,8.63,1.26.23,3.53-1.3,4.31-.73Z"
            ],
            "action_event":
            {
                "touch": "(pat character's head)",
                "click": "(punch character's head)"
            }
        },
        {
            "bodyPart": "chest",
            "paths": [
                "M275.37,379.57c1.68,4.15,6.67,10.12,8.38,15.09,2.93,8.52-1.69,20.56-8.42,26.11-15.4,12.69-38.32,8.34-56.9,9.13-18.89.8-37.86,3.38-56.94,2.03-7.77-.55-17.36-1.88-21.28-9.71-1.81-3.61-10.33-33.49-10.98-38.01-2.24-15.55,3.39-19.73,4.59-31.02,1.02-9.61,2.52-17.21,6.15-26.75,5.5-14.47,11.05-14.43,23.2-20.58,5.92-3,11.66-7.11,18.42-8.78,12.31-3.04,59.28-2.06,72.63.15,4.67.77,16.73,3.48,20.75,5.24,5.37,2.36,11.84,10,11.81,16.01-.04,8.35-6.17,10.69-8.85,16.95-4.57,10.68-6.85,33.53-2.55,44.15Z"
            ],
            "action_event":
            {
                "touch": "(touch character's chest)",
                "click": "(poke character's chest)"
            }
        },
        {
            "bodyPart": "weapon",
            "paths": [
                "M469.94,12c-7.94,26.24-15.81,52.66-24.97,78.5-2.91,8.2-13.12,38.73-17.47,43.52-7.17,7.91-21.82,14.63-24.31,26.68-.65,3.15.53,6.78-1.33,9.67-1.34,2.08-9.6,5.94-11.39,9.42-2.19-1.22-4.1-3.42-6.19-4.64-1.91-1.12-10.75-4.24-10.93-5.63,1.69-4.07-.62-11.06,1.1-14.55.61-1.25,7.01-5.21,8.94-8.05,7.16-10.53,5.13-24.71,8.34-35.65,3.32-11.3,37.99-55.91,47.26-67.73,5.72-7.29,12.58-16.55,18.93-23.07,1.5-1.54,10.22-10.21,12.02-8.47Z"
            ],
            "action_event":
            {
                "touch": "(touch character's weapon)",
                "click": "(grab character's weapon)"
            }
        },
        {
            "bodyPart": "leg",
            "paths": [
                "M133,768c-2-1-4-2-7-29s-3-13-7-18c2-1,4-2,6-2,21,0,36,23,59,17,15-5,34,2,48,0,11-1,14-11,22-12,11-1,21,2,32,3,0,3-2,1-3,3s-1,2-2,3c-5,1-8,23-12,34h-136Z"
            ],
            "action_event":
            {
                "touch": "(touch character's leg)",
                "click": "(poke character's leg)"
            }
        },
        {
            "bodyPart": "face",
            "paths": [
                "M198.99,135.98l7.98-7.99c.98,5.88-2.97,10.5-3.99,15.99,1.72,1.51,15.98-4.23,18.5-5.98l14.48-16c.2,3.58-1.01,7.74-2.5,10.99-1.59,3.48-5.66,6.7-6.49,8.52-.2.43-.25,1.64.49,1.48,3.5-2.76,7.17-5.5,9.92-9.08,6.99-9.12,11.7-24.01,12.6-35.41.07-.94-.46-3.52,1.47-2.49,1.74.93,10.87,24.64,11.79,28.21.83,3.2,2.92,20.81,5.22,20.76l5.49-5.98c1.18,9.52-1.77,16.5-5.79,24.7-3,6.12-1.97,5.51-3.65,11.35-5.81,20.27-8.38,27.74-25.66,40.33-3.95,2.88-20.72,13.94-24.44,14.55-1.8.3-4.04.2-5.86-.04-12.19-1.59-51.25-29.56-54.5-41.48-.83-3.05-4.13-30.24-3.07-31.41,10.82,4.12,4.19.51,2.26-4.77-1.59-4.34-1.31-9.02-1.3-13.57.13-.55,9.02-5.45,9.79-5.54,2.3-.27,3.2,1.88,4.56,1.7,4.51-.6,11.46-7.08,14.72-10.3,2.89-2.86,3.64-7.42,8.97-6.54.18-1.8-3.43-1.03-2.91-3.38.37-1.66,5.08-8.19,6.22-11.81,2.05-6.55,2.76-22.34,5.18-26.81.62-1.14,1.42-1.14,2.03,0,1.84,3.43-1.57,19.19-1.58,24.51,0,7.04,2.39,13.38,2.1,21.04-.17,4.52-1.65,9.85-2.03,14.45Z"
            ],
            "action_event":
            {
                "touch": "(touch character's face)",
                "click": "(poke character's face)"
            }
        }
    ]

    useEffect(() => {
        if (lastUserAction !== "") {
            window.ipc.send('user-message', lastUserAction);
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

    const handleUserClickEvent = (bodyPart: string) => {
        const clickEvent = touchable_areas.find(area => area.bodyPart === bodyPart)?.action_event.click;
        if (clickEvent && clickEvent !== lastUserAction) {
            setIsTouched(true);
            setLastUserAction(clickEvent);
        }
    }

    return (
        <div className="character inline-block relative right-0 bottom-0" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            {isHovered && <OverlayMenu />}
            {touchable_areas &&
                <svg className="absolute top-0 left-0 z-1" viewBox="0 0 477 768">
                    {touchable_areas.map((area, i) => (
                        <g key={`${area.bodyPart}-${i}`}>
                        {area.paths.map((path, index) => (
                            <TouchablePath path={path} onTouch={() => handleUserTouchEvent(area.bodyPart, true)} onClick={() => handleUserClickEvent(area.bodyPart)} key={`${area.bodyPart}-${index}`}/>
                            ))}
                        </g>
                    ))}
                </svg>
            }
            <img src={`/images/${emoticon}.png`} style={{ minWidth: '477px', minHeight: '768px' }} />
        </div>
    )
}