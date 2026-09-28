import { AuthClient } from '@shanutechx/auth-js'
import { SupabaseAuthClientOptions } from './types'

export class SupabaseAuthClient extends AuthClient {
  constructor(options: SupabaseAuthClientOptions) {
    super(options)
  }
}
