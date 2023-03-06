export type Command = {
  name: string
  invoke: () => Promise<void>
}
