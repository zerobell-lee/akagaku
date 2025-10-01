import React, { useEffect, useState } from 'react';
import { SkinManifest } from '@shared/types';

interface CharacterInfoData {
  characterName: string;
  activeSkinId: string;
  skins: SkinManifest[];
  relationship: {
    affection: number;
    attitude: string;
  };
}

export default function CharacterInfoPage() {
  const [characterInfo, setCharacterInfo] = useState<CharacterInfoData | null>(null);

  useEffect(() => {
    console.log('[CharacterInfo] Component mounted, waiting for data...');

    const handler = (data: CharacterInfoData) => {
      console.log('[CharacterInfo] Received data:', data);
      setCharacterInfo(data);
    };

    window.ipc.on('character-info-response', handler);

    // Fallback: Request data if not received within 500ms
    const timeoutId = setTimeout(() => {
      if (!characterInfo) {
        console.log('[CharacterInfo] No data received, requesting...');
        window.ipc.send('user-action', 'GET_CHARACTER_INFO');
      }
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      window.ipc.removeListener('character-info-response', handler);
    };
  }, []);

  const handleSkinChange = (skinId: string) => {
    console.log('[CharacterInfo] Changing skin to:', skinId);
    window.ipc.send('change-skin', skinId);
    if (characterInfo) {
      setCharacterInfo({ ...characterInfo, activeSkinId: skinId });
    }
  };

  if (!characterInfo) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-2xl">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-5xl font-bold mb-4">{characterInfo.characterName}</h1>
          <div className="text-gray-400 text-xl">
            <p>Affection: {characterInfo.relationship.affection}</p>
            <p>Attitude: {characterInfo.relationship.attitude}</p>
          </div>
        </div>

        {/* Skins Section */}
        <div>
          <h2 className="text-4xl font-semibold mb-6">Skins</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {characterInfo.skins.map((skin) => (
              <div
                key={skin.skin_id}
                className={`bg-gray-800 rounded-lg p-6 cursor-pointer transition-all hover:bg-gray-700 ${
                  skin.skin_id === characterInfo.activeSkinId
                    ? 'ring-4 ring-blue-500'
                    : ''
                }`}
                onClick={() => handleSkinChange(skin.skin_id)}
              >
                {/* Thumbnail placeholder */}
                <div className="w-full h-48 bg-gray-700 rounded-md mb-4 flex items-center justify-center">
                  {skin.thumbnail ? (
                    <img
                      src={`local-resource://character/${characterInfo.characterName}/skins/${skin.skin_id}/${skin.thumbnail}`}
                      alt={skin.skin_name}
                      className="w-full h-full object-cover rounded-md"
                    />
                  ) : (
                    <span className="text-gray-500 text-xl">No Image</span>
                  )}
                </div>

                {/* Skin Info */}
                <div>
                  <h3 className="font-semibold text-2xl mb-2">{skin.skin_name}</h3>
                  <p className="text-base text-gray-400 mb-3">{skin.description}</p>
                  <div className="text-sm text-gray-500">
                    <p>Version: {skin.version}</p>
                    {skin.author && <p>Author: {skin.author}</p>}
                  </div>
                  {skin.skin_id === characterInfo.activeSkinId && (
                    <div className="mt-3 text-blue-400 text-base font-semibold">
                      ✓ Active
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
