import {
  CreateStartUpPageContainer,
  ListContainerProperty,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'

// Text container with the project's defaults; pass only what differs.
export function textContainer(props: Partial<TextContainerProperty> & {
  containerID: number
  containerName: string
}) {
  return new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    borderWidth: 0,
    borderColor: 5,
    paddingLength: 4,
    content: '',
    isEventCapture: 0,
    ...props,
  })
}

export function listContainer(props: Partial<ListContainerProperty> & {
  containerID: number
  containerName: string
}) {
  return new ListContainerProperty({
    xPosition: 0,
    yPosition: 0,
    borderWidth: 0,
    borderColor: 5,
    paddingLength: 4,
    isEventCapture: 1,
    ...props,
  })
}

export type Display = ReturnType<typeof createDisplay>

// Thin wrapper over the bridge. Every update goes through one queue,
// so an upgrade is never sent while the previous one is in flight.
export function createDisplay(bridge: EvenAppBridge) {
  let queue = Promise.resolve()

  const enqueue = (task: () => Promise<void>) => {
    queue = queue.then(task).catch((e) => console.error('Display update failed:', e))
    return queue
  }

  return {
    // Draws the page. The startup page can be created only once per app launch,
    // so after a WebView reload (e.g. Vite hot reload) the page is rebuilt instead.
    // Returns false if the host rejected it.
    async render(textObject: TextContainerProperty[], listObject: ListContainerProperty[]) {
      const containerTotalNum = textObject.length + listObject.length;
      // 0 = ok, 1 = invalid params, 2 = oversize, 3 = out of memory
      const result = await bridge.createStartUpPageContainer(
        new CreateStartUpPageContainer({ containerTotalNum, textObject, listObject }),
      )
      if (result === 0) return true

      const rebuilt = await bridge.rebuildPageContainer(new RebuildPageContainer({ containerTotalNum, textObject, listObject }))
      if (!rebuilt) console.error('Page create and rebuild both failed, create result:', result)
      return rebuilt
    },

    async setText(container: TextContainerProperty, content: string, textColor?: number) {
      const ok = await bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: container.containerID,
          containerName: container.containerName,
          content,
          textColor,
        }),
      )
      if (!ok) console.error(`textContainerUpgrade failed for "${container.containerName}"`)
    },

    // Runs several updates back to back, after anything already queued.
    update(task: () => Promise<void>) {
      return enqueue(task)
    },
  }
}
