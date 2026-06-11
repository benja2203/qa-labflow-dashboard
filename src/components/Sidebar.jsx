import React from 'react';
import { Building, ChevronRight, Network, Plus, Trash2 } from 'lucide-react';

export default function Sidebar({
  communities,
  selectedCommunityId,
  view,
  onSelectCommunity,
  onCreateCommunity,
  onDeleteCommunity,
}) {
  return (
    <aside className="sticky top-0 z-10 flex h-auto w-full flex-col border-r border-slate-200 bg-white shadow-sm md:h-screen md:w-72">
      <div className="border-b border-slate-100 p-4">
        <div className="mb-4 flex items-center gap-2 text-blue-600">
          <Network className="h-6 w-6" />
          <h1 className="text-xl font-bold tracking-tight">QA LabFlow</h1>
        </div>

        <button
          type="button"
          onClick={onCreateCommunity}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 p-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nueva Comunidad
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Comunidades
        </h2>

        {communities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs font-medium text-slate-400">
            Aún no hay comunidades creadas.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {communities.map(community => {
              const isActive = selectedCommunityId === community.id && view === 'dashboard';

              return (
                <div
                  key={community.id}
                  className={`flex items-center gap-1 rounded-lg border transition-colors ${
                    isActive
                      ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-transparent text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectCommunity(community.id)}
                    className="flex min-w-0 flex-1 items-center justify-between p-3 text-left"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Building className="h-4 w-4 shrink-0" />
                      <span className="truncate text-sm font-medium">{community.name}</span>
                    </div>
                    <ChevronRight className={`h-4 w-4 shrink-0 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteCommunity(community.id)}
                    className="mr-2 rounded-md p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                    title="Eliminar comunidad"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
