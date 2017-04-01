// @flow
export const SET_STATUS   = 'SET_STATUS'
export const CLOSE_STATUS = 'CLOSE_STATUS'

const STATUS_LIFESPAN = 3000

let statusesQueue = []
let timeout = null

function runQueue(dispatch: () => void) {
  timeout = setTimeout(() => {
    if (statusesQueue.length === 0) {
      dispatch(closeStatus())
      timeout = null
    } else {
      dispatch(setStatus(statusesQueue[0]))
      statusesQueue = statusesQueue.slice(1)
      runQueue(dispatch)
    }
  }, STATUS_LIFESPAN)
}

function setStatus(status) {
  return {
    type: SET_STATUS,
    payload: status,
  }
}

export function closeStatus() {
  return {
    type: CLOSE_STATUS,
  }
}

export function addStatus(message: string, buttonText?: string, buttonCallback?: () => void) {
  return (dispatch: () => void) => {
    const status = {
      message,
      buttonText,
      buttonCallback: buttonCallback ? () => {
        buttonCallback()
        dispatch(closeStatus())
        // @TODO: get next immediately
      } : null,
    }

    if (timeout === null) {
      dispatch(setStatus(status))
      runQueue(dispatch)
    } else {
      statusesQueue.push(status)
    }
  }
}