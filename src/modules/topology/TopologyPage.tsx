import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node as FlowNode,
  type NodeChange,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTopology, type TopologyResponse } from '../../api/topology'
import layoutStyles from '../../components/Layout/Layout.module.css'
import styles from './TopologyPage.module.css'

export function TopologyPage() {
  const { data } = useQuery<TopologyResponse>({
    queryKey: ['topology'],
    queryFn: () => fetchTopology(),
  })

  const [nodes, setNodes] = useState<FlowNode[]>([])
  const [edges, setEdges] = useState<Edge[]>([])

  useEffect(() => {
    if (!data) return

    const initialNodes: FlowNode[] = data.nodes.map((node, index) => ({
      id: node.id,
      position: {
        x: index * 160,
        y: node.type === 'nginx' ? 0 : node.type === 'server' ? 140 : 280,
      },
      data: { label: node.label, type: node.type, status: node.status },
      type: 'default',
    }))

    const initialEdges: Edge[] = data.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: true,
      style: { strokeWidth: 1.4 },
    }))

    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [data])

  const onNodesChange = (changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds))
  }

  const onEdgesChange = (changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds))
  }

  const onConnect = (connection: Connection) => {
    setEdges((eds) =>
      addEdge({ ...connection, animated: true, style: { strokeWidth: 1.4 } }, eds),
    )
  }

  return (
    <div className={styles.root}>
      <div className={layoutStyles.sectionHeader}>
        <div>
          <div className={layoutStyles.sectionTitle}>Traffic flow</div>
          <div className={layoutStyles.sectionHelp}>
            nginx → servers → agents, rendered as an interactive graph
          </div>
        </div>
      </div>

      <div className={styles.canvas}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}

