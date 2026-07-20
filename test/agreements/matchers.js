import { registerToHaveReceived } from '../helpers/matchers.js'
import { receiveMessages } from './helpers/sqs.js'

registerToHaveReceived(receiveMessages, { timeout: 3000 })
