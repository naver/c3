/**
 * Copyright (c) 2017 ~ present NAVER Corp.
 * billboard.js project is licensed under the MIT license
 */
import {transition as d3Transition} from "d3-transition";
import CLASS from "../../config/classes";
import {generateWait} from "../../module/generator";
import {callFn, getOption, isTabVisible, notEmpty} from "../../module/util";

export default {
	redraw(options: any = {}, transitionsValue?): void {
		const $$ = this;
		const {config, state, $el} = $$;
		const {main} = $el;
		const targetsToShow = $$.filterTargetsToShow($$.data.targets);

		const initializing = options.initializing;
		const flow = options.flow;
		const wth = $$.getWithOption(options);
		const duration = wth.Transition ? config.transition_duration : 0;
		const durationForExit = wth.TransitionForExit ? duration : 0;
		const durationForAxis = wth.TransitionForAxis ? duration : 0;
		const transitions = transitionsValue || ($$.axis && $$.axis.generateTransitions(durationForAxis));

		$$.updateSizes(initializing);

		// update legend and transform each g

		if (wth.Legend && config.legend_show) {
			$$.updateLegend($$.mapToIds($$.data.targets), options, transitions);
		} else if (wth.Dimension) {
			// need to update dimension (e.g. axis.y.tick.values) because y tick values should change
			// no need to update axis in it because they will be updated in redraw()
			$$.updateDimension(true);
		}

		// update circleY based on updated parameters
		if (!$$.hasArcType() || state.hasRadar) {
			$$.updateCircleY && $$.updateCircleY();
		}

		// update axis
		if (state.hasAxis) {
			// @TODO: Make 'init' state to be accessible everywhere not passing as argument.
			$$.axis.redrawAxis(targetsToShow, wth, transitions, flow, initializing);

			// Data empty label positioning and text.
			config.data_empty_label_text && main.select(`text.${CLASS.text}.${CLASS.empty}`)
				.attr("x", state.width / 2)
				.attr("y", state.height / 2)
				.text(config.data_empty_label_text)
				.style("display", targetsToShow.length ? "none" : null);

			// grid
			$$.hasGrid() && $$.updateGrid(duration);

			// rect for regions
			config.regions.length && $$.updateRegion(duration);

			// bars
			$$.hasType("bar") && $$.updateBar(durationForExit);

			// lines, areas and circles
			if ($$.hasTypeOf("Line")) {
				$$.updateLine(durationForExit);
			}

			if ($$.hasTypeOf("Area")) {
				$$.updateArea(durationForExit);
			}

			// circles for select
			$el.text && main.selectAll(`.${CLASS.selectedCircles}`)
				.filter($$.isBarType.bind($$))
				.selectAll("circle")
				.remove();

			// event rects will redrawn when flow called
			if (config.interaction_enabled && !flow && wth.EventRect) {
				$$.bindZoomEvent();
			}
		} else {
			// arc
			$el.arcs && $$.redrawArc(duration, durationForExit, wth.Transform);

			// radar
			$el.radar && $$.redrawRadar(durationForExit);
		}

		// @TODO: Axis & Radar type
		if (!state.resizing && ($$.hasPointType() || state.hasRadar)) {
			$$.updateCircle();
		}

		// text
		$$.hasDataLabel() && $$.updateText(durationForExit);

		// title
		$$.redrawTitle && $$.redrawTitle();

		initializing && $$.updateTypesElements();

		$$.generateRedrawList(targetsToShow, flow, duration, wth.Subchart);
		$$.callPluginHook("$redraw", options, duration);
	},

	/**
	 * Generate redraw list
	 * @param {object} targets targets data to be shown
	 * @param {object} flow flow object
	 * @param {number} duration duration value
	 * @param {boolean} withSubchart whether or not to show subchart
	 * @private
	 */
	generateRedrawList(targets, flow: any, duration: number, withSubchart: boolean): void {
		const $$ = this;
		const {config, state} = $$;
		const shape = $$.getDrawShape();

		if (state.hasAxis) {
			// subchart
			config.subchart_show && $$.redrawSubchart(withSubchart, duration, shape);
		}

		// generate flow
		const flowFn = flow && $$.generateFlow({
			targets,
			flow,
			duration: flow.duration,
			shape,
			xv: $$.xv.bind($$)
		});
		const isTransition = (duration || flowFn) && isTabVisible();

		// redraw list
		const redrawList = $$.getRedrawList(shape, flow, flowFn, isTransition);

		// callback function after redraw ends
		const afterRedraw = flow || config.onrendered ? () => {
			flowFn && flowFn();
			callFn(config.onrendered, $$.api);
		} : null;

		if (afterRedraw) {
			// Only use transition when current tab is visible.
			if (isTransition && redrawList.length) {
				// Wait for end of transitions for callback
				const waitForDraw = generateWait();

				// transition should be derived from one transition
				d3Transition().duration(duration)
					.each(() => {
						redrawList
							.reduce((acc, t1) => acc.concat(t1), [])
							.forEach(t => waitForDraw.add(t));
					})
					.call(waitForDraw, afterRedraw);
			} else if (!state.transiting) {
				afterRedraw();
			}
		}

		// update fadein condition
		$$.mapToIds($$.data.targets).forEach(id => {
			state.withoutFadeIn[id] = true;
		});
	},

	getRedrawList(shape, flow, flowFn, isTransition: boolean): Function[] {
		const $$ = <any> this;
		const {config, state: {hasAxis, hasRadar}, $el: {grid}} = $$;
		const {cx, cy, xForText, yForText} = shape.pos;
		const list: Function[] = [];

		if (hasAxis) {
			const {area, bar, line} = shape.type;

			if (config.grid_x_lines.length || config.grid_y_lines.length) {
				list.push($$.redrawGrid(isTransition));
			}

			if (config.regions.length) {
				list.push($$.redrawRegion(isTransition));
			}

			$$.hasTypeOf("Line") && list.push($$.redrawLine(line, isTransition));
			$$.hasTypeOf("Area") && list.push($$.redrawArea(area, isTransition));
			$$.hasType("bar") && list.push($$.redrawBar(bar, isTransition));
			!flow && grid.main && list.push($$.updateGridFocus());
		}

		if (!$$.hasArcType() || hasRadar) {
			notEmpty(config.data_labels) &&
				list.push($$.redrawText(xForText, yForText, flow, isTransition));
		}

		if (($$.hasPointType() || hasRadar) && !config.point_focus_only) {
			$$.redrawCircle && list.push($$.redrawCircle(cx, cy, isTransition, flowFn));
		}

		return list;
	},

	updateAndRedraw(options: any = {}): void {
		const $$ = this;
		const {config, state} = $$;
		let transitions;

		// same with redraw
		options.withTransition = getOption(options, "withTransition", true);
		options.withTransform = getOption(options, "withTransform", false);
		options.withLegend = getOption(options, "withLegend", false);

		// NOT same with redraw
		options.withUpdateXDomain = true;
		options.withUpdateOrgXDomain = true;
		options.withTransitionForExit = false;
		options.withTransitionForTransform = getOption(options, "withTransitionForTransform", options.withTransition);

		// MEMO: called in updateLegend in redraw if withLegend
		if (!(options.withLegend && config.legend_show)) {
			if (state.hasAxis) {
				transitions = $$.axis.generateTransitions(
					options.withTransitionForAxis ? config.transition_duration : 0
				);
			}

			// Update scales
			$$.updateScales();
			$$.updateSvgSize();

			// Update g positions
			$$.transformAll(options.withTransitionForTransform, transitions);
		}

		// Draw with new sizes & scales
		$$.redraw(options, transitions);
	},

	redrawWithoutRescale() {
		this.redraw({
			withY: false,
			withSubchart: false,
			withEventRect: false,
			withTransitionForAxis: false
		});
	}
};