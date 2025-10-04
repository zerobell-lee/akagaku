import React, { useEffect, useState, useRef } from 'react'
import Character from '../components/Character'
import { CharacterDisplayProperties, CharacterProperties, GhostResponse } from '@shared/types'

export default function HomePage() {
  const [characterEmoticon, setCharacterEmoticon] = useState<string>("neutral")
  const [character, setCharacter] = useState<CharacterProperties | null>(null)
  const [displayScale, setDisplayScale] = useState<number>(1.0)

  useEffect(() => {
    console.log("HomePage useEffect")

    const handleCharacterLoaded = (character: CharacterProperties) => {
      console.log('[HomePage] Character loaded:', character);
      setCharacter(character);

      // Only trigger CHARACTER_LOADED if not a skin change
      if (!character.skipGreeting) {
        console.log('[HomePage] Sending CHARACTER_LOADED action');
        window.ipc.send('user-action', 'CHARACTER_LOADED');
      } else {
        console.log('[HomePage] Skipping CHARACTER_LOADED (skin change)');
      }
    };

    const handleGhostEmoticon = (emoticon: string) => {
      console.log('[Frontend] Emoticon received:', emoticon);
      setCharacterEmoticon(emoticon);
    };

    const handleGhostMessage = (message: GhostResponse) => {
      if (message.error) {
        setCharacterEmoticon("sad");
      }
      // Don't update emoticon on message complete - already updated via ghost-emoticon event
    };

    const handleDisplayScale = (scale: number) => {
      console.log('[HomePage] Display scale received:', scale);
      setDisplayScale(scale);
    };

    const unsubscribe1 = window.ipc.on('character_loaded', handleCharacterLoaded);
    const unsubscribe2 = window.ipc.on('ghost-emoticon', handleGhostEmoticon);
    const unsubscribe3 = window.ipc.on('ghost-message', handleGhostMessage);
    const unsubscribe4 = window.ipc.on('display-scale', handleDisplayScale);

    window.ipc.send('user-action', 'APP_STARTED');

    // Cleanup listeners on unmount
    return () => {
      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
      unsubscribe4();
    };
  }, [])

  const calcCurrentGraphic = () => {
    if (character) {
      const foundEmoticon = character.graphics.find(graphic => graphic.emoticon === characterEmoticon);
      if (foundEmoticon) {
        return foundEmoticon.imgSrc;
      }
      return character.graphics.find(graphic => graphic.emoticon === "neutral")?.imgSrc;
    }
    return ""
  }

  const characterDisplayProperties: CharacterDisplayProperties = {
    character_name: character?.character_name,
    character_width: character?.character_width,
    character_height: character?.character_height,
    imgSrc: calcCurrentGraphic(),
    touchable_areas: character?.touchable_areas,
  }

  return (
    <React.Fragment>
      <div className="absolute right-0 bottom-0">
        <div className="flex flex-row">
          {character && <Character {...characterDisplayProperties} displayScale={displayScale} />}
        </div>
      </div>
    </React.Fragment>
  )
}
