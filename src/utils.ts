import spawn from 'cross-spawn'

const escapeShellArg = (arg: string): string => {
  return "'" + arg.replace(/'/g, "'\\''") + "'"
}


export const runCommand = (command: string, additionalArgs: string[] = []) => {
  const escapedArgs = additionalArgs.map(escapeShellArg).join(' ')
  const fullCommand = additionalArgs.length > 0 ? command + ' ' + escapedArgs : command

  console.log('running ', fullCommand)

  return spawn.sync(fullCommand, [], { stdio: 'inherit', shell: true })
}
