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
    // Request character info on mount
    window.ipc.send('user-action', 'GET_CHARACTER_INFO');

    // Listen for response
    window.ipc.on('character-info-response', (data: CharacterInfoData) => {
      console.log('[CharacterInfo] Received data:', data);
      setCharacterInfo(data);
    });
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
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{characterInfo.characterName}</h1>
          <div className="text-gray-400">
            <p>호감도: {characterInfo.relationship.affection}</p>
            <p>태도: {characterInfo.relationship.attitude}</p>
          </div>
        </div>

        {/* Skins Section */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">스킨 선택</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {characterInfo.skins.map((skin) => (
              <div
                key={skin.skin_id}
                className={`bg-gray-800 rounded-lg p-4 cursor-pointer transition-all hover:bg-gray-700 ${
                  skin.skin_id === characterInfo.activeSkinId
                    ? 'ring-2 ring-blue-500'
                    : ''
                }`}
                onClick={() => handleSkinChange(skin.skin_id)}
              >
                {/* Thumbnail placeholder */}
                <div className="w-full h-32 bg-gray-700 rounded-md mb-3 flex items-center justify-center">
                  {skin.thumbnail ? (
                    <img
                      src={`local-resource://character/${characterInfo.characterName}/skins/${skin.skin_id}/${skin.thumbnail}`}
                      alt={skin.skin_name}
                      className="w-full h-full object-cover rounded-md"
                    />
                  ) : (
                    <span className="text-gray-500">No Image</span>
                  )}
                </div>

                {/* Skin Info */}
                <div>
                  <h3 className="font-semibold text-lg mb-1">{skin.skin_name}</h3>
                  <p className="text-sm text-gray-400 mb-2">{skin.description}</p>
                  <div className="text-xs text-gray-500">
                    <p>버전: {skin.version}</p>
                    {skin.author && <p>제작자: {skin.author}</p>}
                  </div>
                  {skin.skin_id === characterInfo.activeSkinId && (
                    <div className="mt-2 text-blue-400 text-sm font-semibold">
                      ✓ 현재 적용 중
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
