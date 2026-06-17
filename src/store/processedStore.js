// Ephemeral in-session store for client-side processed photo blobs.
// Module-level variable persists across React Router navigations within the SPA.

let _results = [] // Array<{ photo, blob }>

export function setProcessedResults(results) { _results = results }
export function getProcessedResults()        { return _results    }
export function clearProcessedResults()      { _results = []      }
