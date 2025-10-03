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

    const relationshipHandler = (data: { affection: number; attitude: string }) => {
      console.log('[CharacterInfo] Received relationship update:', data);
      setCharacterInfo(prev => prev ? {
        ...prev,
        relationship: data
      } : null);
    };

    const unsubscribeInfo = window.ipc.on('character-info-response', handler);
    const unsubscribeRelationship = window.ipc.on('relationship-updated', relationshipHandler);

    // Fallback: Request data if not received within 500ms
    const timeoutId = setTimeout(() => {
      if (!characterInfo) {
        console.log('[CharacterInfo] No data received, requesting...');
        window.ipc.send('user-action', 'GET_CHARACTER_INFO');
      }
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      unsubscribeInfo();
      unsubscribeRelationship();
    };
  }, []);

  const handleSkinChange = (skinId: string) => {
    // Don't change if already active
    if (characterInfo && skinId === characterInfo.activeSkinId) {
      console.log('[CharacterInfo] Skin already active, ignoring:', skinId);
      return;
    }

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
          <h1 className="text-5xl font-bold mb-6">{characterInfo.characterName}</h1>

          {/* Affection Bar Gauge */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl font-semibold text-gray-300">Affection</span>
              <span className="text-xl font-bold text-white">{characterInfo.relationship.affection}/100</span>
            </div>
            <div className="w-full h-8 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500 ease-out"
                style={{
                  width: `${characterInfo.relationship.affection}%`,
                  background: `linear-gradient(to right,
                    ${characterInfo.relationship.affection < 20 ? '#ef4444' :
                      characterInfo.relationship.affection < 40 ? '#f97316' :
                      characterInfo.relationship.affection < 60 ? '#eab308' :
                      characterInfo.relationship.affection < 80 ? '#84cc16' :
                      '#22c55e'
                    } 0%,
                    ${characterInfo.relationship.affection < 20 ? '#dc2626' :
                      characterInfo.relationship.affection < 40 ? '#ea580c' :
                      characterInfo.relationship.affection < 60 ? '#ca8a04' :
                      characterInfo.relationship.affection < 80 ? '#65a30d' :
                      '#16a34a'
                    } 100%)`
                }}
              />
            </div>
          </div>

          {/* Attitude */}
          <div className="text-gray-400 text-xl">
            <p>Attitude: <span className="text-white font-semibold">{characterInfo.relationship.attitude}</span></p>
          </div>
        </div>

        {/* Skins Section */}
        <div>
          <h2 className="text-4xl font-semibold mb-6">Skins</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {characterInfo.skins.map((skin) => (
              <div
                key={skin.skin_id}
                className={`bg-gray-800 rounded-lg p-6 transition-all ${
                  skin.skin_id === characterInfo.activeSkinId
                    ? 'ring-4 ring-blue-500 cursor-default'
                    : 'cursor-pointer hover:bg-gray-700'
                }`}
                onClick={() => handleSkinChange(skin.skin_id)}
              >
                {/* Thumbnail - 3:4 aspect ratio (portrait) */}
                <div className="w-full aspect-[3/4] bg-gray-700 rounded-md mb-4 flex items-center justify-center">
                  {skin.thumbnail ? (
                    <img
                      src={`local-resource://character/${characterInfo.characterName}/skins/${skin.skin_id}/${skin.thumbnail}`}
                      alt={skin.skin_name}
                      className="w-full h-full object-contain rounded-md"
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
