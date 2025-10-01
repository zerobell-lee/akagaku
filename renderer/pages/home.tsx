import React, { useEffect, useState, useRef } from 'react'
import Character from '../components/Character'
import { CharacterDisplayProperties, CharacterProperties, GhostResponse } from '@shared/types'

export default function HomePage() {
  const [characterEmoticon, setCharacterEmoticon] = useState<string>("neutral")
  const [character, setCharacter] = useState<CharacterProperties | null>(null)

  useEffect(() => {
    console.log("HomePage useEffect")
    window.ipc.on('character_loaded', (character: CharacterProperties) => {
      console.log(character)
      setCharacter(character)
      window.ipc.send('user-action', 'CHARACTER_LOADED')
    })

    // Update emoticon immediately when parsed (before message completes)
    window.ipc.on('ghost-emoticon', (emoticon: string) => {
      console.log('[Frontend] Emoticon received:', emoticon);
      setCharacterEmoticon(emoticon);
    })

    window.ipc.on('ghost-message', (message: GhostResponse) => {
      if (message.error) {
        setCharacterEmoticon("sad")
      }
      // Don't update emoticon on message complete - already updated via ghost-emoticon event
    })
    window.ipc.send('user-action', 'APP_STARTED');
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
          {character && <Character {...characterDisplayProperties} />}
        </div>
      </div>
    </React.Fragment>
  )
}
