const React = require('react')
const e = React.createElement
const Component = React.Component
const bindActionCreators = require('redux').bindActionCreators
const connect = require('react-redux').connect
const LoadingActions = require('../actions/loading')
const credentialManager = require('git-credential-node')
const nodegit = require('../utils/nodegit').nodegit
const Dialog = require('material-ui/Dialog').default
const FlatButton = require('material-ui/FlatButton').default
const RaisedButton = require('material-ui/RaisedButton').default
const TextField = require('material-ui/TextField').default
const log = require('../utils/log')
const c = require('material-ui/Card')
const Card = c.Card
const CardTitle = c.CardTitle
const CardText = c.CardText
const t = require('../utils/text')

class Contributors extends Component {

	constructor(props) {
		super(props)

		this.state = {
			url: null,
			username: '',
			password: '',
			usernameDefault: '',
			passwordDefault: '',
			open: false,
		}
	}

	componentDidMount() {
		this.refresh()
	}


	setOpen(open) {
		this.setState(Object.assign({}, this.state, { open }))
	}


	refresh() {
		this.props.actions.loading.IncrementLoadingJobs()
		let repo
		Promise.resolve()
			.then(() => nodegit.Repository.open(this.props.project.path))
			.then((r) => repo = r)
			.then(() => repo.getCurrentBranch())
			.then((reference) => nodegit.Branch.upstream(reference))
			.then((reference) => repo.getRemote(reference.toString().split('/')[2]))
			.catch((error) => {
				return repo.getRemote('origin')
			})
			.then((remote) => remote.url())
			.then((url) => {
				if (url.startsWith('http')) {
					return Promise.resolve()
						.then(() => credentialManager.fill(url))
						.then((data) => {
							const username = data && data.username
							const password = data && data.password
							this.setState(Object.assign({}, this.state, {
								url,
								username,
								password,
								usernameDefault: username,
								passwordDefault: password,
							}))
						})
				}
			})
			.catch((error) => {
				log.error(error)
			})
			.then(() => {
				this.props.actions.loading.DecrementLoadingJobs()
			})
	}


	handleUsernameChange(value) {
		this.setState(Object.assign({}, this.state, { username: value }))
	}


	handlePasswordChange(value) {
		this.setState(Object.assign({}, this.state, { password: value }))
	}


	save() {
		this.setOpen(false)
		this.props.actions.loading.IncrementLoadingJobs()
		Promise.resolve()
			.then(() => credentialManager.approve({
				url: this.state.url,
				username: this.state.username,
				password: this.state.password,
			}))
			.catch((error) => {
				log.error(error)
			})
			.then(() => {
				this.props.actions.loading.DecrementLoadingJobs()
			})
	}


	closeWithoutSave() {
		this.setState(Object.assign({}, this.state, {
			username: this.state.usernameDefault,
			password: this.state.passwordDefault,
			open: false,
		}))
	}


	render() {
		if (this.state.url === null) {
			return null
		}


		const actions = [
			e(
				FlatButton,
				{
					label: t(this.props.settings.language, 'auth_save'),
					primary: true,
					onTouchTap: () => this.save(),
				}
			),
			e(
				FlatButton,
				{
					label: t(this.props.settings.language, 'auth_cancel'),
					onTouchTap: () => this.closeWithoutSave(),
				}
			)
		]

		return (
			e(
				Card,
				{
					className: 'authSetter',
				},
				e(
					CardTitle,
					{
						title: t(this.props.settings.language, 'auth_title'),
					}
				),
				e(
					CardText,
					null,
					e(
						RaisedButton,
						{
							label: t(this.props.settings.language, 'auth_change'),
							onTouchTap: () => this.setOpen(true),
						}
					),
					e(
						Dialog,
						{
							title: t(this.props.settings.language, 'auth_dialog_change'),
							actions: actions,
							modal: false,
							open: this.state.open,
							onRequestClose: () => this.closeWithoutSave(),
						},
						e(
							TextField,
							{
								value: this.state.username || '',
								onChange: (e) => this.handleUsernameChange(e.target.value),
								floatingLabelText: t(this.props.settings.language, 'auth_dialog_username'),
								floatingLabelFixed: true,
							}
						),
						e('br'),
						e(
							TextField,
							{
								value: this.state.password || '',
								onChange: (e) => this.handlePasswordChange(e.target.value),
								floatingLabelText: t(this.props.settings.language, 'auth_dialog_password'),
								floatingLabelFixed: true,
								type: 'password',
							}
						)
					)
				)
			)
		)
	}
}


function mapStateToProps(state) {
	return {
		loading: state.loading,
		settings: state.settings,
	}
}

function mapDispatchToProps(dispatch) {
	return {
		actions: {
			loading: bindActionCreators(LoadingActions, dispatch),
		}
	}
}

module.exports = connect(mapStateToProps, mapDispatchToProps)(Contributors)
