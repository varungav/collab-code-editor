import { Router } from 'express'
import { accessRequestController } from '../controllers/accessRequestController'
import { guestMiddleware } from '../middleware/guestMiddleware'

const router = Router()

router.use(guestMiddleware)

router.get('/', accessRequestController.listIncoming)
router.post('/:requestId/approve', accessRequestController.approve)
router.post('/:requestId/deny', accessRequestController.deny)

export default router
