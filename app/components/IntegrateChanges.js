const React = require('react')
const e = React.createElement
const Component = React.Component
const bindActionCreators = require('redux').bindActionCreators
const connect = require('react-redux').connect
const RaisedButton = require('material-ui/RaisedButton').default
const FlatButton = require('material-ui/FlatButton').default
const RefreshIcon = require('material-ui/svg-icons/navigation/refresh').default
const n = require('../utils/nodegit')
const nodegit = n.nodegit
const getCommonTopCommit = n.getCommonTopCommit
const IntegratorActions = require('../actions/integrator')
const LoadingActions = require('../actions/loading')
const StatusActions = require('../actions/status')
const Diff = require('./Diff')
const hashHistory = require('react-router').hashHistory

class IntegrateChanges extends Component {

	constructor(props) {
		super(props)

		this.state = {
			updating: false,
			shaA: null,
			shaB: null,
		}

		this.repo = null
		this.localBranch = null
		this.remoteBranch = null
		this.localTopCommit = null
		this.remoteTopCommit = null
		this.commonTopCommit = null
	}

	setUpdating(updating) {
		this.setState(Object.assign({}, this.state, { updating }))
		if (updating) {
			this.props.actions.loading.IncrementLoadingJobs()
		} else {
			this.props.actions.loading.DecrementLoadingJobs()
		}
	}

	componentDidMount() {
		this.refresh()
		this.props.actions.integrator.dismissNotification()
	}

	refresh() {
		if (!this.props.projects.active) {
			hashHistory.push('/projects')
			return
		}
		this.setUpdating(true)
		let localBranch
		let remoteBranch
		nodegit.Repository.open(this.props.projects.active.path)
			.then((r) => {
				this.repo = r
				return this.repo.getCurrentBranch()
			})
			.then((reference) => {
				this.localBranch = reference
				return this.repo.getBranchCommit(this.localBranch)
					.then((commit) => this.localTopCommit = commit)
					.then(() => nodegit.Branch.upstream(this.localBranch))
			})
			.then((reference) => {
				this.remoteBranch = reference
				return this.repo.getBranchCommit(this.remoteBranch)
					.then((commit) => this.remoteTopCommit = commit)
			})
			.then(() => {
				return getCommonTopCommit(this.repo, this.localTopCommit, this.remoteTopCommit)
			})
			.then((commit) => {
				this.commonTopCommit = commit
				if (this.remoteTopCommit) {
					Promise.resolve()
						.then(() => {
							if (this.commonTopCommit) {
								return this.commonTopCommit
							} else {
								return null
							}
						})
						.then((secondCommit) => {
							this.setState(Object.assign({}, this.state, {
								shaA: this.remoteTopCommit.sha(),
								shaB: secondCommit && secondCommit.sha(),
							}))
						})
				}
			})
			.catch((error) => {
				console.error(error)
			})
			.then(() => {
				this.setUpdating(false)
			})
	}

	accept() {
		if (!this.repo || !this.remoteTopCommit) {
			return
		}
		this.setUpdating(true)
		Promise.resolve()
			.then(() => this.merge())
			.catch((error) => {
				console.error(error)
			})
			.then((success) => {
				this.setUpdating(false)
				if (success) {
					if (typeof success === 'string') {
						hashHistory.push(`/commitDetail/${success}`)
					} else {
						hashHistory.push('/history')
					}
				} else {
					this.refresh()
				}
			})

	}


	merge() {
		const author = this.repo.defaultSignature()
		return Promise.resolve()
			.then((commit) => nodegit.Reset(this.repo, this.localTopCommit, nodegit.Reset.TYPE.MIXED))
			.then(() => this.repo.mergeBranches(this.localBranch, this.remoteBranch, author))
			.then(() => {
				this.props.actions.status.addStatus(
					'Nové změny byly začleněny'
				)
				return true
			})
			.catch((index) => {
				if (typeof index === 'object' && index.hasConflicts && index.hasConflicts()) {
					return this.solveConflict(index)
				} else {
					throw index // Actually it is not an index
				}
			})
	}


	solveConflict(index) {
		const author = this.repo.defaultSignature()
		return Promise.resolve()
			.then(() => this.repo.mergeBranches(this.localBranch, this.remoteBranch, author, null, {
				fileFavor: nodegit.Merge.FILE_FAVOR.THEIRS,
			}))
			.then((oid) => {
				this.props.actions.status.addStatus(
					'Zkontrolujte, že vaše změny nebyly smazány.'
				)
				return this.repo.getCommit(oid)
			})
			.then((commit) => {
				return nodegit.Reset(this.repo, commit, nodegit.Reset.TYPE.HARD)
					.then(() => commit.sha())
			})
	}


	render() {
		return (
			e(
				'div',
				null,
				e(
					'div',
					null,
					e('h1', null, 'Začlenit změny'),
					e(
						RaisedButton,
						{
							label: 'Přijmout změny',
							secondary: true,
							onTouchTap: this.accept.bind(this),
							disabled: this.state.updating,
						}
					),
					e(
						FlatButton,
						{
							icon: e(RefreshIcon),
							onTouchTap: this.refresh.bind(this),
							disabled: this.state.updating,
						}
					)
				),
				e(
					'div',
					{
						style: {
							marginTop: 20,
						},
					},
					e(
						Diff,
						{
							shaA: this.state.shaA,
							shaB: this.state.shaB,
						}
					)
				)
			)
		)
	}
}


function mapStateToProps(state) {
	return {
		loading: state.loading,
		projects: state.projects,
		settings: state.settings,
	}
}

function mapDispatchToProps(dispatch) {
	return {
		actions: {
			integrator: bindActionCreators(IntegratorActions, dispatch),
			loading: bindActionCreators(LoadingActions, dispatch),
			status: bindActionCreators(StatusActions, dispatch),
		}
	}
}

module.exports = connect(mapStateToProps, mapDispatchToProps)(IntegrateChanges)
