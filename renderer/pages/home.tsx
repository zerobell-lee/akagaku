import React, { useEffect, useState, useRef } from 'react'
import Character, { Emoticon } from '../components/Character'
import SpeechBubble from '../components/SpeechBubble'

interface GhostResponse {
  emoticon: string;
  message: string;
  add_affection: number;
  error?: string;
}

interface TouchableArea {
  bodyPart: string;
  paths: string[];
  action_event: {
    touch: string|undefined;
    click: string|undefined;
  };
}

interface CharacterProps {
  touchable_areas: TouchableArea[];
}

export default function HomePage() {
  const [characterEmoticon, setCharacterEmoticon] = useState<Emoticon>("neutral")
  const [character, setCharacter] = useState<CharacterProps|undefined>(undefined)

  useEffect(() => {
    window.ipc.on('character_loaded', (character: CharacterProps) => {
      console.log(character)
      setCharacter(character)
    })
    window.ipc.on('ghost-message', (message: GhostResponse) => {
      if (message.error) {
        setCharacterEmoticon("angry")
      } else {
        setCharacterEmoticon(message.emoticon as Emoticon)
      }
    })
    window.ipc.send('user-action', 'APP_STARTED');
  }, [])

  return (
    <React.Fragment>
      <div className="absolute right-0 bottom-0">
        <div className="flex flex-row">
          {<Character emoticon={characterEmoticon}/>}
        </div>
      </div>
    </React.Fragment>
  )
}
