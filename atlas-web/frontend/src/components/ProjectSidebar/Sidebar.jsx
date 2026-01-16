import React, { useState, useRef, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  FolderOpen,
  Plus,
  FileText,
  MoreHorizontal,
  Search,
  X,
  Star,
  Pencil,
  FolderPlus,
  Trash2,
  Settings,
  Server,
  LogOut,
  ChevronUp
} from 'lucide-react'
import { useChatStore } from '../../hooks/useChatStore'
import { useAuth } from '../../context/AuthContext'
import { sessionsService } from '../../services/chatService'
import SettingsModal from '../Settings/SettingsModal'
import MCPSettingsModal from '../Settings/MCPSettingsModal'

// Capitalize first letter of a string
const capitalizeFirst = (str) => {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Ally Atlas Logo SVG Component
function AllyLogo({ className = "" }) {
  return (
    <svg width="180" height="42" viewBox="0 0 180 42" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M60.7186 15.4571C60.7186 15.2255 60.545 15.1098 60.1977 15.1098C59.9661 15.1098 59.7057 15.24 59.4162 15.5005C59.1558 15.732 58.9098 15.978 58.6782 16.2385L58.7217 16.1951L55.1619 20.5362H60.7186V15.4571ZM67.6211 13.1562V29.5659C67.6211 29.8553 67.4908 30 67.2304 30H61.1527C60.8633 30 60.7186 29.8553 60.7186 29.5659V26.4836H50.6905L48.0424 29.8264C48.0134 29.9421 47.8977 30 47.6951 30H40.5755C40.373 30 40.2427 29.9276 40.1848 29.7829C40.127 29.6093 40.1414 29.4501 40.2282 29.3054L55.1185 9.50965C55.842 8.93082 56.7681 8.52565 57.8968 8.29412C59.0255 8.06259 60.1977 7.94682 61.4132 7.94682C62.3393 7.94682 63.1786 8.03365 63.9311 8.20729C64.7125 8.352 65.3637 8.62694 65.8846 9.03212C66.4345 9.43729 66.8541 9.9727 67.1435 10.6384C67.4619 11.304 67.6211 12.1433 67.6211 13.1562ZM68.1315 14.0679V8.33753C68.1315 8.07706 68.2762 7.94682 68.5656 7.94682H94.0483C94.3377 7.94682 94.4824 8.07706 94.4824 8.33753V14.0679C94.4824 14.3284 94.3377 14.4586 94.0483 14.4586H84.7582V29.5659C84.7582 29.8553 84.6135 30 84.3241 30H78.2464C77.986 30 77.8557 29.8553 77.8557 29.5659V14.4586H68.5656C68.2762 14.4586 68.1315 14.3284 68.1315 14.0679ZM101.427 7.94682C101.716 7.94682 101.861 8.07706 101.861 8.33753V23.4448H119.182C119.472 23.4448 119.616 23.5895 119.616 23.8789V29.5659C119.616 29.8553 119.472 30 119.182 30H98.7354C98.2724 30 97.8093 29.8987 97.3463 29.6961C96.9121 29.4646 96.507 29.1752 96.1307 28.8279C95.7834 28.4516 95.494 28.0465 95.2625 27.6124C95.0599 27.1493 94.9586 26.6718 94.9586 26.1798V8.33753C94.9586 8.07706 95.0888 7.94682 95.3493 7.94682H101.427ZM139.843 15.4571C139.843 15.2255 139.67 15.1098 139.322 15.1098C139.091 15.1098 138.83 15.24 138.541 15.5005C138.281 15.732 138.035 15.978 137.803 16.2385L137.846 16.1951L134.287 20.5362H139.843V15.4571ZM146.746 13.1562V29.5659C146.746 29.8553 146.616 30 146.355 30H140.277C139.988 30 139.843 29.8553 139.843 29.5659V26.4836H129.815L127.167 29.8264C127.138 29.9421 127.022 30 126.82 30H119.7C119.498 30 119.367 29.9276 119.31 29.7829C119.252 29.6093 119.266 29.4501 119.353 29.3054L134.243 9.50965C134.967 8.93082 135.893 8.52565 137.022 8.29412C138.15 8.06259 139.322 7.94682 140.538 7.94682C141.464 7.94682 142.303 8.03365 143.056 8.20729C143.837 8.352 144.488 8.62694 145.009 9.03212C145.559 9.43729 145.979 9.9727 146.268 10.6384C146.587 11.304 146.746 12.1433 146.746 13.1562ZM169.396 21.9688H153.464C153.03 21.9688 152.581 21.8675 152.118 21.6649C151.684 21.4334 151.279 21.144 150.903 20.7967C150.556 20.4205 150.266 20.0153 150.035 19.5812C149.803 19.1181 149.687 18.6406 149.687 18.1486V11.7671C149.687 11.304 149.803 10.8409 150.035 10.3779C150.266 9.91482 150.556 9.50965 150.903 9.16235C151.279 8.78612 151.684 8.4967 152.118 8.29412C152.581 8.06259 153.03 7.94682 153.464 7.94682H175.908C176.168 7.94682 176.299 8.07706 176.299 8.33753V14.0679C176.299 14.3284 176.168 14.4586 175.908 14.4586H156.59V15.9346H172.522C172.985 15.9346 173.434 16.0504 173.868 16.2819C174.331 16.4845 174.736 16.7739 175.083 17.1501C175.459 17.5264 175.749 17.946 175.951 18.4091C176.183 18.8721 176.299 19.3352 176.299 19.7982V26.1798C176.299 26.6718 176.183 27.1493 175.951 27.6124C175.749 28.0465 175.459 28.4516 175.083 28.8279C174.736 29.1752 174.331 29.4646 173.868 29.6961C173.434 29.8987 172.985 30 172.522 30H147.69C147.401 30 147.256 29.8553 147.256 29.5659V23.8789C147.256 23.5895 147.401 23.4448 147.69 23.4448H169.396V21.9688Z" fill="#B3B3B3"/>
      <path d="M12.2748 1.20605H15.5204V16.3083H12.2748V1.20605Z" fill="#BE507D"/>
      <path d="M17.0698 1.20605H20.3153V16.3083H17.0698V1.20605Z" fill="#BE507D"/>
      <path d="M21.2 5.34534H24.7407L26.8796 12.0148L29.0187 5.34521H32.5588L27.0267 20.5241H23.4866L25.1788 16.2318L21.2 5.34534Z" fill="#BE507D"/>
      <path d="M10.8544 10.906C10.8592 10.1436 10.7248 9.38726 10.4582 8.677C10.0719 7.63911 9.3893 6.74891 8.50204 6.12593C7.61479 5.50295 6.56537 5.17702 5.49471 5.19189C2.07571 5.19189 0 7.70921 0 10.9061C0 14.0359 2.36431 16.4833 4.89711 16.5482L7.69917 13.326L7.65361 13.2458V16.3216H10.8544V10.906ZM7.64231 13.2579L5.43727 13.2637C3.92631 13.2637 2.25642 11.0037 3.95963 9.23295C5.47129 7.66186 7.73634 8.95044 7.73634 11.1368L7.64231 13.2579Z" fill="#BE507D"/>
      <line x1="37.9853" y1="2.63554e-08" x2="37.9853" y2="32.5588" stroke="#828282" strokeWidth="1.20588"/>
      <path d="M109.649 32.0211C109.745 32.0211 109.781 32.0693 109.757 32.1658L108.31 36.3261H113.086C113.19 36.3261 113.226 36.3783 113.194 36.4829L112.651 38.0626C112.643 38.1188 112.607 38.147 112.543 38.147H106.875C106.739 38.147 106.614 38.1148 106.501 38.0505C106.397 37.9862 106.309 37.9018 106.236 37.7973C106.172 37.6928 106.128 37.5762 106.104 37.4476C106.087 37.3189 106.099 37.1863 106.14 37.0496L107.852 32.0934C107.86 32.0452 107.896 32.0211 107.961 32.0211H109.649ZM116.678 32.2381L114.676 38.0626C114.668 38.1188 114.632 38.147 114.568 38.147H112.88C112.84 38.147 112.807 38.1309 112.783 38.0987C112.767 38.0666 112.767 38.0304 112.783 37.9902L114.785 32.1658C114.793 32.1095 114.829 32.0814 114.894 32.0814H116.57C116.674 32.0814 116.71 32.1336 116.678 32.2381ZM120.995 35.9402H118.366C118.326 35.9402 118.294 35.9281 118.27 35.904C118.246 35.8719 118.242 35.8357 118.258 35.7955L118.752 34.3605C118.76 34.3123 118.796 34.2881 118.861 34.2881H122.382C122.511 34.2881 122.627 34.3203 122.732 34.3846C122.844 34.4489 122.933 34.5333 122.997 34.6379C123.061 34.7343 123.101 34.8509 123.117 34.9876C123.142 35.1162 123.134 35.2448 123.093 35.3734L122.49 37.122H122.502C122.462 37.2586 122.39 37.3873 122.285 37.5079C122.189 37.6284 122.072 37.737 121.936 37.8334C121.807 37.9299 121.67 38.0063 121.526 38.0626C121.389 38.1188 121.26 38.147 121.14 38.147H115.786C115.657 38.147 115.536 38.1148 115.424 38.0505C115.319 37.9862 115.231 37.9058 115.159 37.8093C115.094 37.7048 115.05 37.5882 115.026 37.4596C115.01 37.331 115.026 37.1983 115.074 37.0617L116.437 33.1064H116.425C116.465 32.9778 116.537 32.8531 116.642 32.7326C116.746 32.6039 116.863 32.4914 116.992 32.3949C117.128 32.2984 117.265 32.2221 117.402 32.1658C117.546 32.1095 117.679 32.0814 117.8 32.0814H124.07C124.151 32.0814 124.187 32.1336 124.179 32.2381L123.636 33.7937C123.628 33.85 123.596 33.8781 123.54 33.8781H118.077C117.924 34.3123 117.779 34.7263 117.643 35.1202C117.514 35.5061 117.373 35.9161 117.221 36.3502H120.838L120.995 35.9402ZM126.284 32.2381L125.584 34.2881H129.093C129.206 33.9264 129.327 33.5727 129.455 33.227C129.592 32.8813 129.717 32.5276 129.829 32.1658C129.837 32.1095 129.869 32.0814 129.926 32.0814H131.602C131.682 32.0814 131.718 32.1336 131.71 32.2381L129.696 38.0626C129.688 38.1188 129.656 38.147 129.6 38.147H127.924C127.819 38.147 127.783 38.0947 127.815 37.9902L128.527 35.9402H125.018C124.897 36.302 124.772 36.6557 124.644 37.0014C124.515 37.3471 124.395 37.7008 124.282 38.0626C124.274 38.1188 124.238 38.147 124.173 38.147H122.509C122.405 38.147 122.369 38.0947 122.401 37.9902L124.415 32.1658C124.423 32.1095 124.455 32.0814 124.511 32.0814H126.187C126.227 32.0814 126.256 32.0975 126.272 32.1296C126.296 32.1618 126.3 32.198 126.284 32.2381ZM131.418 33.7334L131.961 32.1658C131.969 32.1095 132.001 32.0814 132.058 32.0814H138.991C139.096 32.0814 139.132 32.1336 139.1 32.2381L138.569 33.7937C138.561 33.85 138.525 33.8781 138.461 33.8781H135.916L134.457 38.0626C134.449 38.1188 134.417 38.147 134.361 38.147H132.685C132.644 38.147 132.612 38.1309 132.588 38.0987C132.572 38.0666 132.572 38.0304 132.588 37.9902L134.011 33.8781H131.527C131.439 33.8781 131.402 33.8299 131.418 33.7334ZM143.442 35.9402H139.101C138.973 35.9402 138.852 35.9081 138.739 35.8437C138.635 35.7794 138.547 35.699 138.474 35.6026C138.41 35.4981 138.366 35.3815 138.342 35.2529C138.325 35.1242 138.342 34.9916 138.39 34.8549L139.005 33.1064H138.993C139.033 32.9778 139.105 32.8531 139.21 32.7326C139.314 32.6039 139.431 32.4914 139.559 32.3949C139.688 32.2984 139.821 32.2221 139.957 32.1658C140.102 32.1095 140.235 32.0814 140.355 32.0814H146.517C146.598 32.0814 146.634 32.1336 146.626 32.2381L146.083 33.7937C146.075 33.85 146.043 33.8781 145.987 33.8781H140.645L140.5 34.2881H144.829C144.958 34.2881 145.074 34.3203 145.179 34.3846C145.291 34.4489 145.38 34.5333 145.444 34.6379C145.517 34.7343 145.561 34.8509 145.577 34.9876C145.601 35.1162 145.589 35.2448 145.541 35.3734L144.938 37.122H144.95C144.91 37.2586 144.837 37.3873 144.733 37.5079C144.636 37.6284 144.52 37.737 144.383 37.8334C144.254 37.9299 144.118 38.0063 143.973 38.0626C143.836 38.1188 143.708 38.147 143.587 38.147H137.425C137.321 38.147 137.284 38.0947 137.317 37.9902L137.847 36.4346C137.855 36.3783 137.891 36.3502 137.956 36.3502H143.298L143.442 35.9402ZM146.202 34.2881H151.23L151.375 33.8781H146.431C146.39 33.8781 146.358 33.8661 146.334 33.842C146.31 33.8098 146.306 33.7736 146.322 33.7334L146.853 32.1658C146.861 32.1095 146.897 32.0814 146.961 32.0814H152.798C152.926 32.0814 153.043 32.1135 153.147 32.1779C153.26 32.2422 153.348 32.3266 153.413 32.4311C153.485 32.5276 153.529 32.6441 153.545 32.7808C153.569 32.9094 153.557 33.0381 153.509 33.1667L152.906 34.9273H152.918C152.878 35.0559 152.806 35.1805 152.701 35.3011C152.605 35.4217 152.488 35.5302 152.352 35.6267C152.223 35.7231 152.086 35.7995 151.942 35.8558C151.805 35.9121 151.676 35.9402 151.556 35.9402H147.456C147.343 36.302 147.223 36.6557 147.094 37.0014C146.965 37.3471 146.845 37.7008 146.732 38.0626C146.724 38.1188 146.688 38.147 146.624 38.147H144.947C144.907 38.147 144.875 38.1309 144.851 38.0987C144.835 38.0666 144.835 38.0304 144.851 37.9902L146.105 34.3605C146.113 34.3123 146.145 34.2881 146.202 34.2881ZM153.104 38.147C152.968 38.147 152.847 38.1148 152.743 38.0505C152.638 37.9862 152.55 37.9058 152.477 37.8093C152.413 37.7048 152.369 37.5882 152.345 37.4596C152.329 37.331 152.341 37.1983 152.381 37.0617L153.744 33.1064H153.732C153.772 32.9778 153.844 32.8531 153.949 32.7326C154.053 32.6039 154.17 32.4914 154.298 32.3949C154.435 32.2984 154.572 32.2221 154.708 32.1658C154.853 32.1095 154.986 32.0814 155.106 32.0814H160.714C160.818 32.0814 160.854 32.1336 160.822 32.2381L160.292 33.7937C160.283 33.85 160.247 33.8781 160.183 33.8781H155.396L155.251 34.2881H159.954C159.994 34.2881 160.026 34.3042 160.05 34.3364C160.074 34.3605 160.078 34.3927 160.062 34.4329L159.556 35.8679C159.54 35.9161 159.508 35.9402 159.459 35.9402H154.672L154.527 36.3502H159.242C159.283 36.3502 159.315 36.3663 159.339 36.3984C159.363 36.4226 159.367 36.4547 159.351 36.4949L158.82 38.0626C158.812 38.1188 158.776 38.147 158.712 38.147H153.104ZM160.074 38.147C159.937 38.147 159.816 38.1148 159.712 38.0505C159.607 37.9862 159.519 37.9058 159.447 37.8093C159.382 37.7048 159.338 37.5882 159.314 37.4596C159.298 37.331 159.31 37.1983 159.35 37.0617L160.713 33.1064H160.701C160.741 32.9778 160.813 32.8531 160.918 32.7326C161.022 32.6039 161.139 32.4914 161.267 32.3949C161.404 32.2984 161.541 32.2221 161.677 32.1658C161.822 32.1095 161.955 32.0814 162.075 32.0814H167.683C167.787 32.0814 167.823 32.1336 167.791 32.2381L167.261 33.7937C167.253 33.85 167.216 33.8781 167.152 33.8781H162.365L162.22 34.2881H166.923C166.963 34.2881 166.995 34.3042 167.02 34.3364C167.044 34.3605 167.048 34.3927 167.032 34.4329L166.525 35.8679C166.509 35.9161 166.477 35.9402 166.429 35.9402H161.641L161.497 36.3502H166.212C166.252 36.3502 166.284 36.3663 166.308 36.3984C166.332 36.4226 166.336 36.4547 166.32 36.4949L165.79 38.0626C165.781 38.1188 165.745 38.147 165.681 38.147H160.074ZM166.006 37.9902L167.26 34.3605C167.268 34.3123 167.304 34.2881 167.368 34.2881H169.032C169.073 34.2881 169.105 34.3042 169.129 34.3364C169.153 34.3605 169.157 34.3927 169.141 34.4329L168.466 36.3502H172.107C172.26 35.9161 172.401 35.5061 172.53 35.1202C172.658 34.7263 172.799 34.3123 172.952 33.8781H167.585C167.545 33.8781 167.513 33.8661 167.489 33.842C167.465 33.8098 167.461 33.7736 167.477 33.7334L168.007 32.1658C168.016 32.1095 168.052 32.0814 168.116 32.0814H174.387C174.515 32.0814 174.632 32.1135 174.736 32.1779C174.849 32.2422 174.937 32.3266 175.002 32.4311C175.074 32.5276 175.118 32.6441 175.134 32.7808C175.158 32.9094 175.146 33.0381 175.098 33.1667L173.747 37.122H173.76C173.719 37.2586 173.647 37.3873 173.542 37.5079C173.438 37.6284 173.317 37.737 173.181 37.8334C173.052 37.9299 172.915 38.0063 172.771 38.0626C172.634 38.1188 172.505 38.147 172.385 38.147H166.114C166.01 38.147 165.974 38.0947 166.006 37.9902Z" fill="#CECECE"/>
    </svg>
  )
}

function Sidebar() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [hoveredChat, setHoveredChat] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showMCPSettingsModal, setShowMCPSettingsModal] = useState(false)
  const menuRef = useRef(null)
  const renameInputRef = useRef(null)
  const userMenuRef = useRef(null)

  const {
    sessions,
    currentSessionId,
    clearMessages,
    updateSessionTitle,
    toggleSessionStar,
    deleteSession,
    user
  } = useChatStore()

  const { logout } = useAuth()

  const [isLoadingSessions, setIsLoadingSessions] = useState(true)

  // Fetch sessions from backend on mount - always fetch immediately
  useEffect(() => {
    let isMounted = true

    const fetchSessions = async () => {
      try {
        console.log('[Sidebar] Fetching sessions from backend...')
        const backendSessions = await sessionsService.list()
        console.log('[Sidebar] Backend sessions received:', backendSessions?.length)

        if (!isMounted) return

        if (backendSessions && backendSessions.length > 0) {
          // Normalize session format
          const normalizedBackendSessions = backendSessions.map(s => ({
            id: s.id || s.sessionId,
            title: s.title || 'New conversation',
            starred: s.starred || false,
            projectId: s.projectId || null,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt
          }))

          // Merge with local sessions - keep local sessions that aren't in backend
          const localSessions = useChatStore.getState().sessions || []
          const backendIds = new Set(normalizedBackendSessions.map(s => s.id))
          const localOnlySessions = localSessions.filter(s => !backendIds.has(s.id))

          // Combine: local-only sessions + backend sessions, sorted by date
          const mergedSessions = [...localOnlySessions, ...normalizedBackendSessions]
            .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))

          console.log('[Sidebar] Merged', localOnlySessions.length, 'local +', normalizedBackendSessions.length, 'backend =', mergedSessions.length, 'sessions')
          useChatStore.getState().setSessions(mergedSessions)
          setIsLoadingSessions(false)
        } else {
          console.log('[Sidebar] No backend sessions, keeping local sessions')
          setIsLoadingSessions(false)
        }
      } catch (e) {
        console.error('[Sidebar] Failed to fetch sessions from backend:', e)
        if (isMounted) setIsLoadingSessions(false)
      }
    }

    fetchSessions()

    return () => { isMounted = false }
  }, [])

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  const handleNewChat = () => {
    clearMessages()
    navigate(projectId ? `/project/${projectId}` : '/')
  }

  // Chat menu handlers
  const handleMenuToggle = (e, sessionId) => {
    e.preventDefault()
    e.stopPropagation()
    setOpenMenuId(openMenuId === sessionId ? null : sessionId)
  }

  const handleStarSession = (sessionId) => {
    toggleSessionStar(sessionId)
    setOpenMenuId(null)
  }

  const handleRenameStart = (session) => {
    setRenameValue(session.title || 'New conversation')
    setRenamingId(session.id)
    setOpenMenuId(null)
  }

  const handleRenameSubmit = (sessionId) => {
    if (renameValue.trim()) {
      updateSessionTitle(sessionId, renameValue.trim())
    }
    setRenamingId(null)
  }

  const handleRenameKeyDown = (e, sessionId) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(sessionId)
    } else if (e.key === 'Escape') {
      setRenamingId(null)
    }
  }

  const handleDeleteSession = async (sessionId) => {
    setOpenMenuId(null)

    // Delete from backend first (this also deletes messages, artifacts from DynamoDB and S3)
    try {
      await sessionsService.delete(sessionId)
      console.log('[Sidebar] Deleted session from backend:', sessionId)
    } catch (e) {
      console.error('[Sidebar] Failed to delete session from backend:', e)
    }

    // Delete from local store
    deleteSession(sessionId)

    if (currentSessionId === sessionId) {
      navigate(projectId ? `/project/${projectId}` : '/')
    }
  }

  const handleAddToProject = (sessionId) => {
    // For now, just show projects expanded and close menu
    // TODO: Implement project selection modal
    setProjectsExpanded(true)
    setOpenMenuId(null)
  }

  // Filter sessions by search query
  const filteredSessions = sessions.filter(session =>
    !searchQuery ||
    (session.title || 'New conversation').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <aside
      className="w-[220px] border-r flex flex-col h-full transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)',
        borderOpacity: 'var(--border-opacity)'
      }}
    >
      {/* Header with Ally logo and search */}
      <div className="p-3 flex flex-col items-center">
        <div className="w-full flex items-center justify-center mb-2">
          <AllyLogo />
        </div>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="self-end p-1.5 rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Search size={16} />
        </button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-3 pb-2">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full rounded-lg px-3 py-1.5 text-[13px] outline-none"
              style={{
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                borderWidth: '1px',
                borderColor: 'var(--border-color)'
              }}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* New Chat Button */}
      <div className="px-3 pb-3">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 bg-transparent rounded-lg transition-colors"
          style={{
            color: 'var(--text-primary)',
            borderWidth: '1px',
            borderColor: 'var(--border-color)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Plus size={16} className="text-[#CD477E]" />
          <span className="text-[13px]">New chat</span>
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3">
        {/* Projects Link */}
        <div className="mb-2">
          <Link
            to="/projects"
            className="flex items-center gap-2 w-full px-2 py-1.5 text-[13px] rounded-lg transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <FolderOpen size={14} />
            <span>Projects</span>
          </Link>
        </div>

        {/* Artifacts Link */}
        <div className="mb-2">
          <Link
            to="/artifacts"
            className="flex items-center gap-2 w-full px-2 py-1.5 text-[13px] rounded-lg transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <FileText size={14} />
            <span>Artifacts</span>
          </Link>
        </div>

        {/* Recents Section */}
        <div className="mb-2">
          <p className="text-[11px] uppercase tracking-wider px-2 py-1.5" style={{ color: 'var(--text-muted)' }}>
            Recents
          </p>

          <div className="mt-1">
            {isLoadingSessions ? (
              <div className="flex items-center gap-2 px-2 py-1.5">
                <div className="animate-spin rounded-full h-3 w-3 border-b border-[#CD477E]" />
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Loading chats...</p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <p className="text-[12px] px-2 py-1.5" style={{ color: 'var(--text-muted)' }}>
                {searchQuery ? 'No matching chats' : 'No conversations yet'}
              </p>
            ) : (
              filteredSessions.slice(0, 20).map(session => (
                <div
                  key={session.id}
                  className="relative group"
                  onMouseEnter={() => setHoveredChat(session.id)}
                  onMouseLeave={() => !openMenuId && setHoveredChat(null)}
                  ref={openMenuId === session.id ? menuRef : null}
                >
                  {renamingId === session.id ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameSubmit(session.id)}
                      onKeyDown={(e) => handleRenameKeyDown(e, session.id)}
                      className="w-full py-1 px-2 text-[11px] rounded-lg border border-[var(--border-color)] outline-none"
                      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    />
                  ) : (
                    <>
                      <Link
                        to={projectId ? `/project/${projectId}/chat/${session.id}` : `/chat/${session.id}`}
                        className="flex items-center py-1 px-2 text-[11px] rounded-lg transition-colors pr-6"
                        style={{
                          color: 'var(--text-primary)',
                          backgroundColor: currentSessionId === session.id ? 'var(--bg-tertiary)' : 'transparent'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={(e) => currentSessionId !== session.id && (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {session.starred && (
                          <Star size={8} className="fill-yellow-400 text-yellow-400 mr-1 flex-shrink-0" />
                        )}
                        <span className="truncate">{capitalizeFirst(session.title) || 'New conversation'}</span>
                      </Link>
                      {(hoveredChat === session.id || openMenuId === session.id) && (
                        <button
                          onClick={(e) => handleMenuToggle(e, session.id)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded transition-opacity"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <MoreHorizontal size={12} />
                        </button>
                      )}
                      {/* Dropdown menu */}
                      {openMenuId === session.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-[var(--border-color)] shadow-xl overflow-hidden z-50" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                          <button
                            onClick={() => handleStarSession(session.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 transition-colors text-left"
                            style={{ color: 'var(--text-primary)' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Star size={14} className={session.starred ? 'fill-yellow-400 text-yellow-400' : ''} style={{ color: session.starred ? undefined : 'var(--text-muted)' }} />
                            <span className="text-[13px]">{session.starred ? 'Unstar' : 'Star'}</span>
                          </button>
                          <button
                            onClick={() => handleRenameStart(session)}
                            className="w-full flex items-center gap-2 px-3 py-2 transition-colors text-left"
                            style={{ color: 'var(--text-primary)' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Pencil size={14} style={{ color: 'var(--text-muted)' }} />
                            <span className="text-[13px]">Rename</span>
                          </button>
                          <button
                            onClick={() => handleAddToProject(session.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 transition-colors text-left"
                            style={{ color: 'var(--text-primary)' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <FolderPlus size={14} style={{ color: 'var(--text-muted)' }} />
                            <span className="text-[13px]">Add to project</span>
                          </button>
                          <div className="border-t border-[var(--border-color)] my-1" />
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 transition-colors text-left"
                            style={{ color: '#ef4444' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Trash2 size={14} />
                            <span className="text-[13px]">Delete</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* User Profile Section */}
      <div className="border-t border-[var(--border-color)] p-3">
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {/* Avatar with initials */}
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-medium" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
              {user?.initials || 'U'}
            </div>
            {/* Name and plan */}
            <div className="flex-1 text-left">
              <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {user?.name || 'User'}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {user?.plan || 'Free plan'}
              </p>
            </div>
            {/* Chevron */}
            <ChevronUp
              size={14}
              className={`transition-transform ${showUserMenu ? '' : 'rotate-180'}`}
              style={{ color: 'var(--text-muted)' }}
            />
          </button>

          {/* User Menu Dropdown */}
          {showUserMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-[var(--border-color)] shadow-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <button
                onClick={() => {
                  setShowSettingsModal(true)
                  setShowUserMenu(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Settings size={16} style={{ color: 'var(--text-muted)' }} />
                <span className="text-[13px]">Settings</span>
              </button>
              <button
                onClick={() => {
                  setShowMCPSettingsModal(true)
                  setShowUserMenu(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Server size={16} style={{ color: 'var(--text-muted)' }} />
                <span className="text-[13px]">MCP Servers</span>
              </button>
              <div className="border-t border-[var(--border-color)]" />
              <button
                onClick={async () => {
                  setShowUserMenu(false)
                  await logout()
                  navigate('/login')
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <LogOut size={16} style={{ color: 'var(--text-muted)' }} />
                <span className="text-[13px]">Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* MCP Settings Modal */}
      <MCPSettingsModal
        isOpen={showMCPSettingsModal}
        onClose={() => setShowMCPSettingsModal(false)}
      />
    </aside>
  )
}

export default Sidebar
