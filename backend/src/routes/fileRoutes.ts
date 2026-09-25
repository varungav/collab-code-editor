import { Router } from 'express'
import { fileController } from '../controllers/fileController'
import { guestMiddleware } from '../middleware/guestMiddleware'

const router = Router()

router.use(guestMiddleware)

router.get('/:fileId', fileController.getOne)
router.put('/:fileId', fileController.update)
router.patch('/:fileId', fileController.rename)
router.delete('/:fileId', fileController.remove)

export default router
