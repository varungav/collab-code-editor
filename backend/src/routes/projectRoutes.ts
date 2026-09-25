import { Router } from 'express'
import { accessRequestController } from '../controllers/accessRequestController'
import { chatController } from '../controllers/chatController'
import { fileController } from '../controllers/fileController'
import { projectController } from '../controllers/projectController'
import { projectMemberController } from '../controllers/projectMemberController'
import { guestMiddleware } from '../middleware/guestMiddleware'

const router = Router()

router.use(guestMiddleware)

router.get('/', projectController.getAll)
router.post('/', projectController.create)
router.get('/:projectId', projectController.getOne)
router.get('/:projectId/access', accessRequestController.getAccessStatus)
router.post('/:projectId/join', projectController.joinByLink)
router.post('/:projectId/access-requests', accessRequestController.requestAccess)
router.get('/:projectId/files', fileController.getByProject)
router.post('/:projectId/files', fileController.create)
router.get('/:projectId/messages', chatController.getHistory)
router.get('/:projectId/members', projectMemberController.list)
router.post('/:projectId/members', projectMemberController.add)
router.patch('/:projectId/members/:userId', projectMemberController.updateRole)
router.delete('/:projectId/members/:userId', projectMemberController.remove)

export default router
