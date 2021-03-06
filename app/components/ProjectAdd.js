const React = require('react')
const e = React.createElement
const Component = React.Component
const bindActionCreators = require('redux').bindActionCreators
const connect = require('react-redux').connect
const Dialog = require('material-ui/Dialog').default
const RadioButton = require('material-ui/RadioButton').RadioButton
const RadioButtonGroup = require('material-ui/RadioButton').RadioButtonGroup
const IconAdd = require('material-ui/svg-icons/content/add-box').default
const FlatButton = require('material-ui/FlatButton').default
const TextField = require('material-ui/TextField').default
const Tabs = require('material-ui/Tabs').Tabs
const Tab = require('material-ui/Tabs').Tab
const ProjectsActions = require('../actions/projects')
const StatusActions = require('../actions/status')
const LoadingActions = require('../actions/loading')
const dialog = require('electron').remote.dialog
const path = require('path')
const fsp = require('fs-promise')
const nodegit = require('../utils/nodegit').nodegit
const remoteCallbacks = require('../utils/remoteCallbacks')
const FloatingActionButton = require('material-ui/FloatingActionButton').default
const ContentAdd = require('material-ui/svg-icons/content/add').default
const log = require('../utils/log')
const t = require('../utils/text')

const TAB_URL   = 'TAB_URL'
const TAB_LOCAL = 'TAB_LOCAL'

class ProjectAdd extends Component {

	constructor(props) {
		super(props)

		this.state = {
			openAddModal: false,
			directoryPath: '',
			url: '',
			active: TAB_LOCAL,
			directoryModal: false,
		}
	}


	// Zobrazí okno pro výběr adresáře
	getDirectory() {
		this.setState(Object.assign({}, this.state, { directoryModal: true }))
		setTimeout(() => {
			const dialogDirectories = dialog.showOpenDialog({properties: ['openDirectory']})
			if (dialogDirectories) {
				const repoDirectory = dialogDirectories[0]
				this.handlePathChange(null, repoDirectory)
			}
			this.setState(Object.assign({}, this.state, { directoryModal: false }))
		}, 1)
	}


	setActiveTab(active) {
		const newState = Object.assign({}, this.state, { active })
		this.setState(newState)
	}


	handlePathChange(e, value) {
		const newState = Object.assign({}, this.state, { directoryPath: value })
		this.setState(newState)
	}


	handleURLChange(e, value) {
		const newState = Object.assign({}, this.state, { url: value })
		this.setState(newState)
	}


	prependProject(project) {
		const newProjects = [project].concat(this.props.projects.list)
		this.props.actions.projects.setProjects(newProjects)
	}


	// Vrátí UI komponentu pro uživatelský vstup, URL
	getURLField() {
		return (
			e(
				TextField,
				{
					name: 'url',
					type: 'url',
					hintText: t(this.props.settings.language, 'project_add_url'),
					value: this.state.url,
					onChange: this.handleURLChange.bind(this),
				}
			)
		)
	}


	// Vrátí UI komponentu pro uživatelský vstup, adresář
	getDirectoryField() {
		return (
			e(
				'div',
				null,
				e(
					TextField,
					{
						name: 'path',
						hintText: t(this.props.settings.language, 'project_add_path'),
						value: this.state.directoryPath,
						onChange: this.handlePathChange.bind(this),
					}
				),
				e(
					FlatButton,
					{
						label: t(this.props.settings.language, 'project_add_directory'),
						style: {
							verticalAlign: 'middle',
						},
						onTouchTap: this.getDirectory.bind(this),
					}
				)
			)
		)
	}


	// Zobrazí modální okno
	openAddModal(open) {
		const newState = Object.assign({}, this.state, { openAddModal: open })
		this.setState(newState)
	}


	// Přidá nový projekt podle uživatelského vstupu
	addProject() {
		const url = this.state.url
		const localPath = this.state.directoryPath
		const project = {
			name: path.basename(localPath),
			note: localPath,
			path: localPath,
			key: Date.now(),
			stats: {
				additions: 0,
				removals: 0,
				files: 0,
			},
		}
		this.openAddModal(false)

		this.props.actions.loading.IncrementLoadingJobs()
		Promise.resolve()
			.then(() => {
				if (this.state.active === TAB_LOCAL) {
					return this.prepareLocalProject(localPath)
				} else if (this.state.active === TAB_URL) {
					return this.prepareUrlProject(localPath, url)
				}
			})
			.then(() => {
				this.prependProject(project)
				this.props.actions.status.addStatus(
					t(this.props.settings.language, 'project_notification_added').replace('{name}', project.name),
					t(this.props.settings.language, 'project_notification_revert'),
					() => {
						this.props.actions.projects.removeProject(project)
					}
				)
				this.props.actions.projects.setActiveProject(project)
			})
			.catch((error) => {
				log.error(error)
			})
			.then(() => {
				this.props.actions.loading.DecrementLoadingJobs()
			})
	}


	// Pokusí se přidat již lokálně existující projekt
	prepareLocalProject(path) {
		let errorMessage = null
		return Promise.resolve()
			.then(() => {
				return fsp.stat(path)
					.catch((error) => {
						console.warn(error)
						errorMessage = t(this.props.settings.language, 'project_error_noproject_location')
						throw new Error('Location not found.')
					})
			})
			.then(() => {
				return nodegit.Repository.open(path)
					.catch((error) => {
						console.warn(error)
						this.props.actions.status.addStatus(
							t(this.props.settings.language, 'project_error_noproject')
						)
						errorMessage = 'Použijte dřívě vytvořený'
						throw new Error('Invalid location.')
					})
			})
			.catch((error) => {
				if (errorMessage) {
					this.props.actions.status.addStatus(
						errorMessage
					)
				}
				throw error
			})
	}


	// Pokusí se přidat projekt z URL
	prepareUrlProject(path, url) {
		let errorMessage = null
		const trimmedUrl = url.trim()
		let repo
		return Promise.resolve()
			.then(() => {
				return fsp.ensureDir(path)
					.catch((error) => {
						console.warn(error)
						errorMessage = t(this.props.settings.language, 'project_error_nolocation')
						throw new Error('Location not found.')
					})
			})
			.then(() => {
				return fsp.readdir(path)
					.then((files) => {
						if (files.length > 0) {
							errorMessage = t(this.props.settings.language, 'project_error_notempty')
							throw new Error('Location not empty.')
						}
					})
			})
			.then(() => {
				if (trimmedUrl.length === 0) {
					errorMessage = t(this.props.settings.language, 'project_error_urlempty')
					throw new Error('Empty url field.')
				}
			})
			.then(() => {
				return nodegit.Repository.init(path, 0)
					.then((r) => repo = r)
					.then(() => nodegit.Remote.create(repo, 'origin', trimmedUrl))
					.catch((error) => {
						console.warn(error)
						errorMessage = t(this.props.settings.language, 'project_error_creation')
						throw new Error('Unable to init repository.')
					})
			})
			.catch((error) => {
				if (errorMessage) {
					this.props.actions.status.addStatus(
						errorMessage
					)
				}
				return fsp.emptyDir(path)
					.then(() => {
						throw error
					})
			})
	}


	render() {
		const actions = [
			e(
				FlatButton,
				{
					label: t(this.props.settings.language, 'project_add'),
					primary: true,
					onTouchTap: this.addProject.bind(this),
				}
			),
			e(
				FlatButton,
				{
					label: t(this.props.settings.language, 'project_cancel'),
					onTouchTap: () => this.openAddModal(false),
				}
			),
		]

		return (
			e(
				'div',
				null,
				this.state.directoryModal ? e(
					'div',
					{
						style: {
							position: 'fixed',
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							zIndex: 10000,
							backgroundColor: 'rgba(0,0,0,0.5)',
						}
					}
				) : null,
				e(
					Dialog,
					{
						actions: actions,
						onRequestClose: () => this.openAddModal(false),
						open: this.state.openAddModal,
					},
					e(
						Tabs,
						{
							initialSelectedIndex: this.state.active === TAB_LOCAL ? 0 : 1,
						},
						e(
							Tab,
							{
								label: t(this.props.settings.language, 'project_from_directory'),
								onActive: () => this.setActiveTab(TAB_LOCAL),
							},
							e(
								'div',
								null,
								e('p', null, t(this.props.settings.language, 'project_select_directory')),
								this.getDirectoryField()
							)
						),
						e(
							Tab,
							{
								label: t(this.props.settings.language, 'project_from_url'),
								onActive: () => this.setActiveTab(TAB_URL),
							},
							e(
								'div',
								null,
								e('p', null, t(this.props.settings.language, 'project_select_url')),
								this.getURLField(),
								this.getDirectoryField()
							)
						)
					)
				),
				e(
					FloatingActionButton,
					{
						onTouchTap: () => this.openAddModal(true),
						style: {
							position: 'fixed',
							right: 50,
							bottom: 50,
							zIndex: 2,
						},
					},
					e(ContentAdd)
				)
			)
		)
	}
}


function mapStateToProps(state) {
	return {
		projects: state.projects,
		settings: state.settings,
	}
}

function mapDispatchToProps(dispatch) {
	return {
		actions: {
			projects: bindActionCreators(ProjectsActions, dispatch),
			status: bindActionCreators(StatusActions, dispatch),
			loading: bindActionCreators(LoadingActions, dispatch),
		}
	}
}

module.exports = connect(mapStateToProps, mapDispatchToProps)(ProjectAdd)
